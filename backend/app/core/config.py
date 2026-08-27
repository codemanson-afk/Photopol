from functools import lru_cache
from typing import Dict, List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Photopol"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-to-a-long-random-secret-key-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    DATABASE_URL: str = "postgresql+psycopg://photopol:photopol@localhost:5432/photopol"
    REDIS_URL: str = "redis://localhost:6379/0"

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    STORAGE_BACKEND: str = "s3"  # s3 | local
    LOCAL_STORAGE_DIR: str = "./uploads"

    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "photopol"
    S3_REGION: str = "us-east-1"
    S3_PUBLIC_URL: str = "http://localhost:9000/photopol"
    S3_USE_SSL: bool = False

    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"

    INITIAL_CREDITS: int = 50
    CREDIT_COST_BACKGROUND_REMOVAL: int = 5
    CREDIT_COST_BG_PRO: int = 8
    CREDIT_COST_RESIZE: int = 1
    CREDIT_COST_CROP: int = 1
    CREDIT_COST_OBJECT_REMOVE: int = 8
    CREDIT_COST_OBJECT_REMOVE_BEST: int = 20
    CREDIT_COST_UPSCALE_2X: int = 6
    CREDIT_COST_UPSCALE_4X: int = 14
    CREDIT_COST_ENHANCE: int = 4
    CREDIT_COST_BG_REPLACE: int = 12

    REPLICATE_API_TOKEN: str = ""
    REPLICATE_BG_REMOVAL_MODEL: str = "recraft-ai/recraft-remove-background"
    REPLICATE_UPSCALE_MODEL: str = "nightmareai/real-esrgan"
    REPLICATE_OBJECT_REMOVE_MODEL: str = "cjwbw/lama"
    REPLICATE_ENHANCE_MODEL: str = "nightmareai/real-esrgan"
    REMOVEBG_API_KEY: str = ""
    # removebg | replicate | local | auto (removebg → local rembg)
    AI_BG_PROVIDER: str = "auto"
    # inline = process in API (dev); queue = Arq worker
    JOB_EXECUTION_MODE: str = "inline"

    FAL_KEY: str = ""
    FAL_UPSCALE_MODEL: str = "fal-ai/esrgan"

    STRIPE_ENABLED: bool = True
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID_CREDITS: str = ""
    STRIPE_PRICE_ID_PRO_MONTHLY: str = ""
    STRIPE_PRICE_ID_BUSINESS_MONTHLY: str = ""
    STRIPE_SUCCESS_URL: str = "http://localhost:3000/billing?success=1"
    STRIPE_CANCEL_URL: str = "http://localhost:3000/billing?canceled=1"
    STRIPE_PORTAL_RETURN_URL: str = "http://localhost:3000/billing"
    STRIPE_CREDITS_PER_PACK: int = 100

    PADDLE_ENABLED: bool = False
    PADDLE_API_KEY: str = ""
    PADDLE_WEBHOOK_SECRET: str = ""
    PADDLE_ENV: str = "sandbox"  # sandbox | production
    PADDLE_PRICE_ID_CREDITS: str = ""
    PADDLE_PRICE_ID_PRO_MONTHLY: str = ""
    PADDLE_PRICE_ID_BUSINESS_MONTHLY: str = ""
    PADDLE_SUCCESS_URL: str = ""
    PADDLE_CANCEL_URL: str = ""

    USE_SIGNED_URLS: bool = False
    SIGNED_URL_EXPIRES_SECONDS: int = 3600

    FRONTEND_URL: str = "http://localhost:3000"
    AI_RATE_LIMIT_PER_MINUTE: int = 10

    # Guest free-tier caps (images / jobs). Off for local testing; re-enable for prod.
    GUEST_LIMITS_ENABLED: bool = False

    # Image processing limits
    MAX_IMAGE_DIMENSION: int = 8192
    MIN_IMAGE_DIMENSION: int = 16

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_image_types_list(self) -> List[str]:
        return [t.strip() for t in self.ALLOWED_IMAGE_TYPES.split(",") if t.strip()]

    @property
    def paddle_success_url(self) -> str:
        return self.PADDLE_SUCCESS_URL or self.STRIPE_SUCCESS_URL

    @property
    def paddle_cancel_url(self) -> str:
        return self.PADDLE_CANCEL_URL or self.STRIPE_CANCEL_URL


def billing_providers(settings: Optional[Settings] = None) -> Dict[str, bool]:
    """Usable providers: enabled flag + API credentials present."""
    s = settings or get_settings()
    return {
        "stripe": bool(s.STRIPE_ENABLED and s.STRIPE_SECRET_KEY),
        "paddle": bool(s.PADDLE_ENABLED and s.PADDLE_API_KEY),
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
