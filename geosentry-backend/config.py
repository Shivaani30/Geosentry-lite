"""Small, local configuration loader for GeoSentry backend settings."""

import os
from pathlib import Path


_LOCAL_ENV_KEYS = {
    "GEOSENTRY_JWT_SECRET",
    "GEOSENTRY_DATABASE_URL",
    "TELEMETRY_BASE_URL",
    "TELEMETRY_PATH_TEMPLATE",
    "TELEMETRY_TIMEOUT_SECONDS",
    "GEOSENTRY_TELEMETRY_API_BASE_URL",
    "GEOSENTRY_TELEMETRY_TIMEOUT_SECONDS",
}


def load_local_env() -> None:
    """Load supported KEY=value entries from the backend .env without overriding the shell."""
    env_path = Path(__file__).resolve().with_name(".env")
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key not in _LOCAL_ENV_KEYS or key in os.environ:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[key] = value


load_local_env()


def get_jwt_secret() -> str:
    secret = os.getenv("GEOSENTRY_JWT_SECRET", "").strip()
    if len(secret) < 32:
        raise RuntimeError(
            "Set GEOSENTRY_JWT_SECRET to a random value of at least 32 characters "
            "in the backend environment or geosentry-backend/.env."
        )
    return secret


def validate_auth_config() -> None:
    get_jwt_secret()
