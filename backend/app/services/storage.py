import io
import logging
import re
import uuid
from pathlib import Path
from typing import Optional, Tuple, Union

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from PIL import Image as PILImage

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

SAFE_FILENAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def sanitize_filename(name: str) -> str:
    base = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    cleaned = SAFE_FILENAME_RE.sub("_", base).strip("._")
    return cleaned[:200] or "image"


class LocalStorageService:
    """Filesystem storage for localhost without Docker/MinIO."""

    def __init__(self) -> None:
        settings = get_settings()
        self.settings = settings
        self.root = Path(settings.LOCAL_STORAGE_DIR).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def ensure_bucket(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def build_key(self, user_id: uuid.UUID, project_id: uuid.UUID, filename: str) -> str:
        safe = sanitize_filename(filename)
        return f"users/{user_id}/projects/{project_id}/{uuid.uuid4().hex}_{safe}"

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not str(path).startswith(str(self.root)):
            raise AppError("Invalid storage key", code="storage_error", status_code=400)
        return path

    def upload_bytes(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def download_bytes(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise AppError("Image not found in storage", code="storage_error", status_code=404)
        return path.read_bytes()

    def public_url(self, key: str) -> str:
        base = self.settings.S3_PUBLIC_URL.rstrip("/")
        return f"{base}/{key}"

    def delete_object(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()


class StorageService:
    def __init__(self) -> None:
        settings = get_settings()
        self.settings = settings
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
            use_ssl=settings.S3_USE_SSL,
        )
        self.bucket = settings.S3_BUCKET

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            try:
                self.client.create_bucket(Bucket=self.bucket)
                if self.settings.ENVIRONMENT == "development":
                    policy = (
                        '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":'
                        '{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}'
                        % self.bucket
                    )
                    self.client.put_bucket_policy(Bucket=self.bucket, Policy=policy)
            except ClientError as exc:
                logger.warning("Could not create bucket: %s", exc)

    def build_key(self, user_id: uuid.UUID, project_id: uuid.UUID, filename: str) -> str:
        safe = sanitize_filename(filename)
        return f"users/{user_id}/projects/{project_id}/{uuid.uuid4().hex}_{safe}"

    def upload_bytes(self, key: str, data: bytes, content_type: str) -> None:
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        except ClientError as exc:
            logger.exception("Storage upload failed")
            raise AppError("Failed to store image", code="storage_error", status_code=500) from exc

    def download_bytes(self, key: str) -> bytes:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=key)
            return obj["Body"].read()
        except ClientError as exc:
            logger.exception("Storage download failed")
            raise AppError("Image not found in storage", code="storage_error", status_code=404) from exc

    def public_url(self, key: str) -> str:
        if self.settings.USE_SIGNED_URLS:
            return self.presigned_url(key)
        base = self.settings.S3_PUBLIC_URL.rstrip("/")
        return f"{base}/{key}"

    def presigned_url(self, key: str, expires: Optional[int] = None) -> str:
        ttl = expires or self.settings.SIGNED_URL_EXPIRES_SECONDS
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=ttl,
            )
        except ClientError:
            base = self.settings.S3_PUBLIC_URL.rstrip("/")
            return f"{base}/{key}"

    def delete_object(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError:
            logger.warning("Failed to delete object %s", key)


def read_image_meta(data: bytes) -> Tuple[int, int, str]:
    try:
        with PILImage.open(io.BytesIO(data)) as img:
            img.load()
            fmt = (img.format or "PNG").upper()
            return img.width, img.height, fmt
    except Exception as exc:
        raise AppError("Invalid image file", code="invalid_image", status_code=400) from exc


_storage: Optional[Union[StorageService, LocalStorageService]] = None


def get_storage() -> Union[StorageService, LocalStorageService]:
    global _storage
    if _storage is None:
        settings = get_settings()
        if settings.STORAGE_BACKEND.lower() == "local":
            _storage = LocalStorageService()
        else:
            _storage = StorageService()
    return _storage
