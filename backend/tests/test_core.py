import io
import uuid

import pytest
from PIL import Image as PILImage
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.main import create_app
from app.models import User, UserRole, CreditTransactionType
from app.services.credits import CreditService
from app.services.image_ops import crop_image, resize_image
from app.services.storage import sanitize_filename


def test_sanitize_filename():
    cleaned = sanitize_filename("../../etc/passwd.jpg")
    assert ".." not in cleaned
    assert cleaned.endswith(".jpg") or "passwd" in cleaned


def test_verify_password():
    h = hash_password("secretpass")
    assert verify_password("secretpass", h)
    assert not verify_password("wrong", h)


def _png_bytes(w=64, h=64, color=(200, 100, 50, 255)):
    img = PILImage.new("RGBA", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_resize_image():
    data = _png_bytes(200, 100)
    out, ct, w, h = resize_image(data, width=100, height=50)
    assert ct in ("image/png", "image/jpeg")
    assert w == 100 and h == 50
    assert len(out) > 0


def test_resize_aspect():
    data = _png_bytes(400, 200)
    out, ct, w, h = resize_image(data, aspect_ratio="1:1")
    assert w == h
    assert len(out) > 0


def test_crop_image():
    data = _png_bytes(200, 200)
    out, ct, w, h = crop_image(data, x=10, y=10, width=50, height=40)
    assert w == 50 and h == 40


def test_crop_out_of_bounds():
    data = _png_bytes(50, 50)
    with pytest.raises(Exception):
        crop_image(data, x=40, y=40, width=50, height=50)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = Session()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(db_session, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db

    # Skip real S3 ensure_bucket noise
    from app.services import storage as storage_mod

    class DummyStorage:
        def ensure_bucket(self):
            return None

        def build_key(self, *a, **k):
            return f"test/{uuid.uuid4().hex}.png"

        def upload_bytes(self, key, data, content_type):
            self._last = (key, data, content_type)

        def download_bytes(self, key):
            return _png_bytes()

        def public_url(self, key):
            return f"http://localhost:9000/photopol/{key}"

    monkeypatch.setattr(storage_mod, "get_storage", lambda: DummyStorage())
    monkeypatch.setattr("app.services.processing.get_storage", lambda: DummyStorage())
    monkeypatch.setattr("app.main.get_storage", lambda: DummyStorage())

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_register_login_me(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": "password123", "full_name": "Test User"},
    )
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "user@example.com"
    assert body["credit_balance"] > 0

    login = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert login.status_code == 200

    bad = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrongpassxx"},
    )
    assert bad.status_code == 401


def test_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "password123", "full_name": "A"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    assert client.post("/api/auth/register", json=payload).status_code == 409


def test_protected_route(client):
    assert client.get("/api/dashboard/stats").status_code == 401


def test_project_ownership(client):
    a = client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "password": "password123", "full_name": "A"},
    ).json()["access_token"]
    b = client.post(
        "/api/auth/register",
        json={"email": "b@example.com", "password": "password123", "full_name": "B"},
    ).json()["access_token"]

    project = client.post(
        "/api/projects",
        headers={"Authorization": f"Bearer {a}"},
        json={"name": "Private"},
    ).json()

    forbidden = client.get(
        f"/api/projects/{project['id']}",
        headers={"Authorization": f"Bearer {b}"},
    )
    assert forbidden.status_code == 404


def test_admin_forbidden_for_user(client):
    token = client.post(
        "/api/auth/register",
        json={"email": "norm@example.com", "password": "password123", "full_name": "N"},
    ).json()["access_token"]
    res = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_credit_deduct_idempotent(db_session):
    user = User(
        id=uuid.uuid4(),
        email="c@example.com",
        password_hash=hash_password("password123"),
        full_name="C",
        role=UserRole.USER,
        credit_balance=20,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    svc = CreditService(db_session)
    ref = str(uuid.uuid4())
    t1 = svc.deduct(user, 5, operation="background_removal", reference_id=ref)
    t2 = svc.deduct(user, 5, operation="background_removal", reference_id=ref)
    db_session.commit()
    assert t1.id == t2.id
    assert user.credit_balance == 15


def test_upload_validation(client):
    token = client.post(
        "/api/auth/register",
        json={"email": "up@example.com", "password": "password123", "full_name": "U"},
    ).json()["access_token"]
    project = client.post(
        "/api/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Up"},
    ).json()

    bad = client.post(
        f"/api/projects/{project['id']}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("x.txt", b"not-an-image", "text/plain")},
    )
    assert bad.status_code == 400

    good = client.post(
        f"/api/projects/{project['id']}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("shot.png", _png_bytes(), "image/png")},
    )
    assert good.status_code == 200, good.text
    assert good.json()["original_filename"]
