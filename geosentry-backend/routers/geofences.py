from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from auth import get_current_user
from database import get_session
from models import Device, Geofence, User

router = APIRouter()


class GeofenceInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    radius: float = Field(gt=0, le=100_000, allow_inf_nan=False)
    is_active: bool = True
    device_id: Optional[int] = Field(default=None, gt=0)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value


class GeofenceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    radius: Optional[float] = Field(default=None, gt=0, le=100_000, allow_inf_nan=False)
    is_active: Optional[bool] = None
    device_id: Optional[int] = Field(default=None, gt=0)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value


def public_geofence(fence: Geofence) -> dict:
    return {
        "id": fence.id,
        "name": fence.name,
        "latitude": fence.latitude,
        "longitude": fence.longitude,
        "center": {"lat": fence.latitude, "lng": fence.longitude},
        "radius": fence.radius,
        "is_active": fence.is_active,
        "active": fence.is_active,
        "created_at": fence.created_at,
        "user_id": fence.user_id,
        "device_id": fence.device_id,
    }


def require_owned_device(session: Session, user_id: int, device_id: Optional[int]) -> None:
    if device_id is None:
        return
    device = session.get(Device, device_id)
    if device is None or device.user_id != user_id:
        raise HTTPException(status_code=404, detail="Device not found")


def get_owned_fence(session: Session, user_id: int, fence_id: int) -> Geofence:
    fence = session.get(Geofence, fence_id)
    if fence is None or fence.user_id != user_id:
        raise HTTPException(status_code=404, detail="Geofence not found")
    return fence


@router.get("")
def list_geofences(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    fences = session.exec(
        select(Geofence).where(Geofence.user_id == user.id).order_by(Geofence.created_at, Geofence.id)
    ).all()
    return [public_geofence(fence) for fence in fences]


@router.post("")
def create_geofence(
    data: GeofenceInput,
    response: Response,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_owned_device(session, user.id, data.device_id)
    fence = Geofence(**data.model_dump(), user_id=user.id)
    session.add(fence)
    session.commit()
    session.refresh(fence)
    response.status_code = 201
    return public_geofence(fence)


@router.get("/{fence_id}")
def read_geofence(
    fence_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return public_geofence(get_owned_fence(session, user.id, fence_id))


@router.put("/{fence_id}")
def update_geofence(
    fence_id: int,
    data: GeofenceInput,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    fence = get_owned_fence(session, user.id, fence_id)
    require_owned_device(session, user.id, data.device_id)
    for key, value in data.model_dump().items():
        setattr(fence, key, value)
    session.add(fence)
    session.commit()
    session.refresh(fence)
    return public_geofence(fence)


@router.delete("/{fence_id}")
def delete_geofence(
    fence_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    fence = get_owned_fence(session, user.id, fence_id)
    session.delete(fence)
    session.commit()
    return {"deleted": True, "id": fence_id}
