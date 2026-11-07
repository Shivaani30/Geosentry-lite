from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field as PydanticField, field_validator
from sqlmodel import Session, select
from models import Device, User
from database import get_session
from auth import get_current_user
from routers.telemetry import refresh_device_telemetry
from telemetry_service import fetch_telemetry

router = APIRouter()

class TelemetryDeviceInput(BaseModel):
    name: str = PydanticField(min_length=1, max_length=120)
    external_id: str = PydanticField(min_length=1, max_length=200)

class TelemetryIdentifierInput(BaseModel):
    external_id: str = PydanticField(min_length=1, max_length=200)

class DeviceCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = PydanticField(min_length=1, max_length=120)
    latitude: float = PydanticField(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = PydanticField(ge=-180, le=180, allow_inf_nan=False)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Device name is required")
        return value

def public_device(device: Device):
    return {
        "id": device.id,
        "name": device.name,
        "latitude": device.latitude,
        "longitude": device.longitude,
        "user_id": device.user_id,
        "telemetry_configured": bool(device.external_id),
    }

@router.post("/register-telemetry")
async def register_telemetry_device(
    data: TelemetryDeviceInput,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    name = data.name.strip()
    external_id = data.external_id.strip()
    if not name or not external_id:
        raise HTTPException(status_code=422, detail="Device name and telemetry identifier are required")
    # Validate a real upstream fix before creating a row; never seed a placeholder position.
    position = await fetch_telemetry(external_id)
    device = Device(name=name, latitude=position["lat"], longitude=position["lng"], user_id=user.id, external_id=external_id)
    session.add(device)
    session.commit()
    session.refresh(device)
    return {**public_device(device), **position}

@router.put("/{device_id}/telemetry")
async def configure_telemetry_device(
    device_id: int,
    data: TelemetryIdentifierInput,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    device = session.get(Device, device_id)
    if device is None or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")
    external_id = data.external_id.strip()
    if not external_id:
        raise HTTPException(status_code=422, detail="Telemetry identifier is required")
    position = await fetch_telemetry(external_id)
    device.external_id = external_id
    device.latitude, device.longitude = position["lat"], position["lng"]
    session.add(device)
    session.commit()
    session.refresh(device)
    return {**public_device(device), **position}

@router.post("/add")
def add_device(
    data: DeviceCreateInput,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    device = Device(**data.model_dump(), user_id=user.id)
    session.add(device)
    session.commit()
    session.refresh(device)
    return public_device(device)

@router.post("/update/{id}")
def update_location(
    id: int,
    lat: float = Query(ge=-90, le=90, allow_inf_nan=False),
    lon: float = Query(ge=-180, le=180, allow_inf_nan=False),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    dev = session.get(Device, id)
    if dev is None or dev.user_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")
    dev.latitude = lat
    dev.longitude = lon
    session.commit()
    return public_device(dev)

@router.get("/all")
def all_devices(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return [public_device(device) for device in session.exec(select(Device).where(Device.user_id == user.id)).all()]
