from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from database import get_session
from models import Device
from models import User
from auth import get_current_user
from routers.telemetry import refresh_device_telemetry

router = APIRouter()

# ---------------------------------------------------------
# 1. Update device location (GPS)
# ---------------------------------------------------------
@router.post("/update_location")
def update_location(
    device_id: int,
    latitude: float = Query(ge=-90, le=90, allow_inf_nan=False),
    longitude: float = Query(ge=-180, le=180, allow_inf_nan=False),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    device = session.get(Device, device_id)

    if not device or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")

    device.latitude = latitude
    device.longitude = longitude

    session.add(device)
    session.commit()
    session.refresh(device)

    return {
        "message": "Location updated successfully",
        "device": {
            "id": device.id,
            "name": device.name,
            "latitude": device.latitude,
            "longitude": device.longitude,
        },
    }

# ---------------------------------------------------------
# 2. Get all device locations (for map dashboard)
# ---------------------------------------------------------
@router.get("/devices_location")
async def get_devices_location(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    statement = select(Device).where(Device.user_id == user.id)
    results = session.exec(statement).all()
    response = []
    for device in results:
        item = {
            "id": device.id,
            "name": device.name,
            "user_id": device.user_id,
            "telemetry_configured": bool(device.external_id),
            "telemetry_available": False,
        }
        if device.external_id:
            try:
                position = await refresh_device_telemetry(device, session)
                item.update({"latitude": position["lat"], "longitude": position["lng"], "telemetry_available": True})
                for key in ("timestamp", "time", "speed", "satellites"):
                    if key in position:
                        item[key] = position[key]
            except HTTPException:
                # A failed live source must not be presented as a current position.
                item.update({"latitude": None, "longitude": None, "telemetry_available": False})
        else:
            item.update({"latitude": device.latitude, "longitude": device.longitude})
        response.append(item)
    return response
