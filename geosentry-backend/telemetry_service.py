"""Server-side adapter for replaceable GPS telemetry providers.

The historical AWS API Gateway provider is currently unavailable and is not
used as a default. Configure a provider explicitly in the backend environment.
"""
import math
import os
from urllib.parse import quote
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException

def _find_number(item, names):
    if not isinstance(item, dict):
        return None
    for name in names:
        value = item.get(name)
        if value is None or isinstance(value, bool):
            continue
        try:
            result = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(result):
            return result
    return None


def parse_telemetry(payload):
    """Read the newest coordinate-bearing item, supporting the recovered key variants."""
    candidates = payload if isinstance(payload, list) else [payload]
    for item in reversed(candidates):
        lat = _find_number(item, ("lat", "latitude", "Lat", "Latitude"))
        lng = _find_number(item, ("lng", "lon", "longitude", "Lng", "Lon", "Longitude"))
        if lat is None or lng is None:
            continue
        if not -90 <= lat <= 90 or not -180 <= lng <= 180:
            continue
        result = {"lat": lat, "lng": lng}
        if isinstance(item, dict):
            for key in ("timestamp", "time", "speed", "satellites"):
                if item.get(key) is not None:
                    result[key] = item[key]
        return result
    raise HTTPException(status_code=502, detail="Telemetry response contains no valid coordinates")


def build_telemetry_request(external_id: str) -> tuple[str, float]:
    # Historical provider configuration is intentionally not a default: it is
    # unavailable, and live mode must never silently point at a stale service.
    base_url = (os.getenv("TELEMETRY_BASE_URL") or os.getenv("GEOSENTRY_TELEMETRY_API_BASE_URL") or "").strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=503, detail="Telemetry provider is not configured")

    path_template = os.getenv("TELEMETRY_PATH_TEMPLATE", "/{external_id}").strip()
    if not path_template.startswith("/"):
        raise HTTPException(status_code=503, detail="Telemetry provider path is not configured correctly")
    try:
        path = path_template.format(external_id=quote(external_id, safe=""))
        url = f"{base_url}{path}"
        parsed_url = urlsplit(url)
        timeout = float(os.getenv("TELEMETRY_TIMEOUT_SECONDS") or os.getenv("GEOSENTRY_TELEMETRY_TIMEOUT_SECONDS", "10"))
    except (KeyError, ValueError):
        raise HTTPException(status_code=503, detail="Telemetry provider configuration is invalid")
    if parsed_url.scheme not in ("https", "http") or not parsed_url.hostname or parsed_url.username or parsed_url.password or timeout <= 0:
        raise HTTPException(status_code=503, detail="Telemetry provider configuration is invalid")
    return url, timeout


async def fetch_telemetry(external_id: str) -> dict:
    url, timeout = build_telemetry_request(external_id)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Telemetry service timed out")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Telemetry service returned HTTP {exc.response.status_code}")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Telemetry service is unavailable")
    except ValueError:
        raise HTTPException(status_code=502, detail="Telemetry service returned invalid JSON")
    return parse_telemetry(payload)
