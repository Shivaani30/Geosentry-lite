from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from auth import get_current_user
from database import get_session
from models import Device, User
from telemetry_service import fetch_telemetry

router = APIRouter()


async def refresh_device_telemetry(device: Device, session: Session) -> dict:
    if not device.external_id:
        raise HTTPException(status_code=409, detail="No telemetry source is configured for this device")
    position = await fetch_telemetry(device.external_id)
    device.latitude = position["lat"]
    device.longitude = position["lng"]
    session.add(device)
    session.commit()
    session.refresh(device)
    return position


@router.get("/{device_id}")
async def get_device_telemetry(
    device_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    device = session.get(Device, device_id)
    if device is None or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")
    return await refresh_device_telemetry(device, session)
