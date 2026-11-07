from fastapi import APIRouter
from math import radians, sin, cos, sqrt, atan2

router = APIRouter()

# -------------------------
# 1. Distance Calculation
# -------------------------
def distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two GPS points using the Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Earth radius in KM

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c


# -------------------------
# 2. Basic Geofence Check
# -------------------------
@router.get("/check_geofence")
def check_geofence(
    device_lat: float,
    device_lon: float,
    fence_lat: float,
    fence_lon: float,
    radius_km: float
):
    """
    API example:
    /check_geofence?device_lat=12.9&device_lon=80.1&fence_lat=12.91&fence_lon=80.12&radius_km=1
    """
    dist = distance(device_lat, device_lon, fence_lat, fence_lon)

    inside = dist <= radius_km

    return {
        "distance_km": round(dist, 3),
        "radius_km": radius_km,
        "inside_geofence": inside
    }
