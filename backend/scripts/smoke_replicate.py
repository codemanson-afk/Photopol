"""Live smoke: Replicate-only enhance / remove_bg / upscale + store_ready outcome.

Usage (from backend/, with uvicorn up and AI_BG_PROVIDER=replicate):
  set SMOKE_API_BASE=http://127.0.0.1:8002/api
  python -m scripts.smoke_replicate

Default API base is http://127.0.0.1:8002/api (override with SMOKE_API_BASE).
Does not print API tokens. Exit 0 on all pass.
"""

from __future__ import annotations

import io
import os
import sys
import time
import uuid
from typing import Any, Optional

import httpx
from PIL import Image as PILImage

from app.core.config import get_settings

BASE = (os.environ.get("SMOKE_API_BASE") or "http://127.0.0.1:8002/api").rstrip("/")
TIMEOUT = 300.0


def _png(w: int = 256, h: int = 256) -> bytes:
    img = PILImage.new("RGB", (w, h), (210, 120, 80))
    # simple subject blob so bg-removal has something to detect
    for x in range(80, 176):
        for y in range(60, 200):
            img.putpixel((x, y), (40, 40, 180))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _mask_png(w: int = 256, h: int = 256) -> bytes:
    m = PILImage.new("L", (w, h), 0)
    for x in range(100, 140):
        for y in range(100, 140):
            m.putpixel((x, y), 255)
    buf = io.BytesIO()
    m.save(buf, format="PNG")
    return buf.getvalue()


def _fail(step: str, detail: Any) -> None:
    print(f"FAIL  {step}: {detail}")
    sys.exit(1)


def _ok(step: str, extra: str = "") -> None:
    print(f"PASS  {step}" + (f" -- {extra}" if extra else ""))


def _poll_job(client: httpx.Client, headers: dict, job_id: str) -> dict:
    deadline = time.time() + TIMEOUT
    while time.time() < deadline:
        r = client.get(f"{BASE}/jobs/{job_id}", headers=headers, timeout=60.0)
        if r.status_code >= 400:
            _fail("poll_job", r.text)
        data = r.json()
        st = data.get("status")
        if st == "COMPLETED":
            return data
        if st == "FAILED":
            _fail("job_failed", data)
        time.sleep(2.0)
    _fail("poll_timeout", job_id)
    return {}


def _create_job(
    client: httpx.Client,
    headers: dict,
    *,
    project_id: str,
    image_id: str,
    tool: str,
    version_id: Optional[str] = None,
    model_id: Optional[str] = None,
    params: Optional[dict] = None,
) -> dict:
    # Low Replicate credit accounts are limited to burst=1; space predictions.
    time.sleep(12.0)
    body: dict[str, Any] = {
        "project_id": project_id,
        "image_id": image_id,
        "tool": tool,
        "idempotency_key": f"smoke-{tool}-{uuid.uuid4().hex[:10]}",
    }
    if version_id:
        body["version_id"] = version_id
    if model_id:
        body["model_id"] = model_id
    if params:
        body["params"] = params
    r = client.post(f"{BASE}/jobs", headers=headers, json=body, timeout=TIMEOUT)
    if r.status_code >= 400:
        _fail(f"job_{tool}", r.text)
    data = r.json()
    if data.get("status") == "COMPLETED":
        return data
    if data.get("status") == "FAILED":
        _fail(f"job_{tool}", data)
    return _poll_job(client, headers, data["id"])


def main() -> None:
    # Clear cached settings so backend/.env edits are visible in this process
    get_settings.cache_clear()
    settings = get_settings()
    if (settings.AI_BG_PROVIDER or "").lower() != "replicate":
        _fail("config", f"AI_BG_PROVIDER={settings.AI_BG_PROVIDER!r} (want replicate)")
    if not settings.REPLICATE_API_TOKEN:
        _fail("config", "REPLICATE_API_TOKEN empty")
    if settings.REMOVEBG_API_KEY:
        _fail("config", "REMOVEBG_API_KEY should be empty for Replicate-only")
    if getattr(settings, "FAL_KEY", ""):
        _fail("config", "FAL_KEY should be empty for Replicate-only")
    _ok("config", "AI_BG_PROVIDER=replicate, token set, REMOVEBG/FAL empty")

    with httpx.Client(timeout=TIMEOUT) as client:
        # health
        root = BASE[: -len("/api")] if BASE.endswith("/api") else BASE.rsplit("/api", 1)[0]
        h = client.get(f"{BASE}/health")
        if h.status_code >= 400:
            h = client.get(f"{root}/health")
        if h.status_code >= 400:
            _fail("health", f"backend not reachable at {BASE} — start uvicorn (e.g. port 8002)")
        body = h.json() if h.headers.get("content-type", "").startswith("application/json") else {}
        if isinstance(body, dict) and body.get("service") and "photopol" not in str(body.get("service")):
            _fail("health", f"wrong service on this port: {body}")
        _ok("health", str(body.get("service") or h.status_code))

        g = client.post(f"{BASE}/guest/session", json={})
        if g.status_code >= 400:
            _fail("guest_session", g.text)
        token = g.json().get("guest_token") or g.json().get("access_token") or g.json().get("token")
        if not token:
            _fail("guest_session", g.json())
        headers = {"Authorization": f"Bearer {token}"}
        _ok("guest_session")

        p = client.post(
            f"{BASE}/projects",
            headers=headers,
            json={"name": f"smoke-replicate-{uuid.uuid4().hex[:8]}"},
        )
        if p.status_code >= 400:
            _fail("create_project", p.text)
        project_id = p.json()["id"]
        _ok("create_project", project_id)

        files = {"file": ("smoke.jpg", _png(), "image/jpeg")}
        up = client.post(
            f"{BASE}/projects/{project_id}/upload",
            headers=headers,
            files=files,
        )
        if up.status_code >= 400:
            _fail("upload", up.text)
        image = up.json()
        image_id = image["id"]
        versions = image.get("versions") or []
        original = next((v for v in versions if v.get("kind") == "ORIGINAL"), versions[0] if versions else None)
        if not original:
            _fail("upload", "no ORIGINAL version")
        version_id = original["id"]
        _ok("upload", image_id)

        enh = _create_job(
            client,
            headers,
            project_id=project_id,
            image_id=image_id,
            tool="enhance",
            version_id=version_id,
        )
        _ok("enhance", f"provider_job status={enh.get('status')} result={enh.get('result_version_id')}")

        bg = _create_job(
            client,
            headers,
            project_id=project_id,
            image_id=image_id,
            tool="remove_bg",
            version_id=version_id,
            model_id="bg-standard",
        )
        _ok("remove_bg", f"result={bg.get('result_version_id')}")

        up2 = _create_job(
            client,
            headers,
            project_id=project_id,
            image_id=image_id,
            tool="upscale",
            version_id=version_id,
            model_id="upscale-2x",
            params={"scale": 2},
        )
        _ok("upscale", f"result={up2.get('result_version_id')}")

        # object_remove
        try:
            time.sleep(12.0)
            mask_files = {"file": ("mask.png", _mask_png(), "image/png")}
            mr = client.post(
                f"{BASE}/projects/{project_id}/masks",
                headers=headers,
                files=mask_files,
            )
            if mr.status_code >= 400:
                _fail("object_remove_mask", mr.text)
            mask_key = mr.json().get("mask_storage_key")
            orm = _create_job(
                client,
                headers,
                project_id=project_id,
                image_id=image_id,
                tool="object_remove",
                version_id=version_id,
                params={"mask_storage_key": mask_key} if mask_key else None,
            )
            _ok("object_remove", f"result={orm.get('result_version_id')}")
        except SystemExit:
            raise
        except Exception as exc:  # noqa: BLE001
            _fail("object_remove", exc)

        time.sleep(12.0)
        an = client.post(
            f"{BASE}/exports/pipelines/outcomes/analyze",
            headers=headers,
            json={"project_id": project_id, "image_id": image_id, "version_id": version_id},
        )
        if an.status_code >= 400:
            _fail("outcomes_analyze", an.text)
        _ok("outcomes_analyze")

        run = client.post(
            f"{BASE}/exports/pipelines/outcomes/run",
            headers=headers,
            json={
                "project_id": project_id,
                "image_id": image_id,
                "outcome": "store_ready",
                "version_id": version_id,
                "bg_color": "#FFFFFF",
                "export_pack": False,
            },
        )
        if run.status_code >= 400:
            _fail("outcomes_run_store_ready", run.text)
        out = run.json()
        if not out.get("result_version_id"):
            _fail("outcomes_run_store_ready", out)
        improved = out.get("what_we_improved") or []
        _ok(
            "outcomes_run_store_ready",
            f"result={out.get('result_version_id')} credits={out.get('credits_charged')} improved={len(improved)}",
        )
        if improved:
            for line in improved:
                print(f"      · {line}")

    print("\nAll Replicate smoke checks passed.")
    print("Security: rotate the Replicate token if it was pasted in chat.")


if __name__ == "__main__":
    main()
