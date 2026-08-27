"""Export packs — multi-size ZIP from one version (Phase 3)."""

from __future__ import annotations

import io
import logging
import uuid
import zipfile
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Image, ImageVersion, User
from app.services.export_presets import get_preset_group
from app.services.image_ops import encode_export, fit_resize
from app.services.processing import ProcessingService
from app.services.storage import get_storage

logger = logging.getLogger(__name__)


class ExportPackService:
    def __init__(self, db: Session):
        self.db = db
        self.storage = get_storage()
        self.proc = ProcessingService(db)

    def create_pack(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        version_id: Optional[uuid.UUID] = None,
        group: str = "social",
        fmt: str = "jpg",
        quality: int = 92,
        strip_metadata: bool = True,
        preset_ids: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        project = self.proc.get_owned_project(user, project_id)
        image = self.proc.get_owned_image(user, image_id, project.id)

        if version_id:
            version = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.id == version_id, ImageVersion.image_id == image.id)
                .first()
            )
        else:
            version = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.image_id == image.id)
                .order_by(ImageVersion.created_at.desc())
                .first()
            )
        if not version:
            raise AppError("No version to export", code="not_found", status_code=404)

        presets = get_preset_group(group)
        if not presets:
            raise AppError("Unknown preset group", code="invalid_group", status_code=400)
        if preset_ids:
            wanted = set(preset_ids)
            presets = [p for p in presets if p["id"] in wanted]
        if not presets:
            raise AppError("No presets selected", code="empty_pack", status_code=400)

        source = self.storage.download_bytes(version.storage_key)
        buf = io.BytesIO()
        files = []
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in presets:
                resized, _ct, _w, _h = fit_resize(
                    source, width=p["width"], height=p["height"], fit=p.get("fit") or "cover"
                )
                encoded, ect = encode_export(
                    resized, fmt=fmt, quality=quality, strip_metadata=strip_metadata
                )
                ext = "png" if "png" in ect else ("webp" if "webp" in ect else "jpg")
                name = f"{p['id']}_{p['width']}x{p['height']}.{ext}"
                zf.writestr(name, encoded)
                files.append({"id": p["id"], "label": p["label"], "filename": name})

        zip_bytes = buf.getvalue()
        key = self.storage.build_key(
            user.id, project.id, f"pack_{group}_{image.id}.zip"
        )
        self.storage.upload_bytes(key, zip_bytes, "application/zip")
        url = self.storage.public_url(key)

        return {
            "group": group,
            "file_count": len(files),
            "files": files,
            "download_url": url,
            "storage_key": key,
            "byte_size": len(zip_bytes),
        }
