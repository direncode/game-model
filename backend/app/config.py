"""Application configuration loaded from environment variables."""

from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Latent Intelligence platform."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # ── Database ────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/latent_intelligence"
    DATABASE_SYNC_URL: str = "postgresql://postgres:postgres@localhost:5432/latent_intelligence"

    # ── Redis ───────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Neo4j ───────────────────────────────────────────────────────────
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "neo4j"

    # ── MinIO / S3 ──────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "latent-intelligence"

    # ── Elasticsearch ───────────────────────────────────────────────────
    ELASTICSEARCH_URL: str = "http://localhost:9200"

    # ── JWT / Auth ──────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── External APIs ───────────────────────────────────────────────────
    ANTHROPIC_API_KEY: Optional[str] = None

    # ── AWS SES (Email) ──────────────────────────────────────────────────
    AWS_SES_REGION: str = "us-east-1"
    AWS_SES_FROM_EMAIL: str = "noreply@latentocean.com"
    APP_URL: str = "http://localhost:3000"

    # ── Session Management ───────────────────────────────────────────────
    SESSION_MAX_PER_USER: int = 10

    # ── Application ─────────────────────────────────────────────────────
    APP_NAME: str = "Latent Intelligence"
    APP_ENV: str = "development"
    APP_DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:  # noqa: N805
        """Keep the raw string; use the property for the parsed list."""
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS_ORIGINS as a list of strings."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
