from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from auth import get_current_user
from database import get_session
from models import Device, Geofence, GeofenceAlert, User

router = APIRouter()


class AlertInput(BaseModel):
    event_type: Literal["ENTER", "EXIT"]
    transition_key: str = Field(min_length=1, max_length=200)
    geofence_id: int = Field(gt=0)
    device_id: int = Field(gt=0)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)

    @model_validator(mode="after")
    def trim_transition_key(self):
        self.transition_key = self.transition_key.strip()
        if not self.transition_key:
            raise ValueError("Transition key is required")
        return self


def get_owned_alert(session: Session, user_id: int, alert_id: int) -> GeofenceAlert:
    alert = session.get(GeofenceAlert, alert_id)
    if alert is None or alert.user_id != user_id:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


def public_alert(alert: GeofenceAlert) -> dict:
    is_enter = alert.event_type == "ENTER"
    return {
        "id": alert.id,
        "event_type": alert.event_type,
        "transition_key": alert.transition_key,
        "timestamp": alert.timestamp,
        "time": alert.timestamp,
        "geofence_id": alert.geofence_id,
        "geofence_name": alert.geofence_name,
        "fence": alert.geofence_name,
        "device_id": alert.device_id,
        "device_name": alert.device_name,
        "device": alert.device_name,
        "latitude": alert.latitude,
        "longitude": alert.longitude,
        "lat": alert.latitude,
        "lon": alert.longitude,
        "tone": "safe" if is_enter else "warning",
        "title": "Entered safe zone" if is_enter else "Exited safe zone",
    }


@router.get("")
def list_alerts(
    geofence_id: int | None = Query(default=None, gt=0),
    device_id: int | None = Query(default=None, gt=0),
    event_type: Literal["ENTER", "EXIT"] | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    statement = select(GeofenceAlert).where(GeofenceAlert.user_id == user.id)
    if geofence_id is not None:
        statement = statement.where(GeofenceAlert.geofence_id == geofence_id)
    if device_id is not None:
        statement = statement.where(GeofenceAlert.device_id == device_id)
    if event_type is not None:
        statement = statement.where(GeofenceAlert.event_type == event_type)
    alerts = session.exec(statement.order_by(GeofenceAlert.timestamp.desc(), GeofenceAlert.id.desc()).limit(limit)).all()
    return [public_alert(alert) for alert in alerts]


@router.get("/{alert_id}")
def read_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return public_alert(get_owned_alert(session, user.id, alert_id))


@router.post("")
def create_alert(
    data: AlertInput,
    response: Response,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    existing = session.exec(select(GeofenceAlert).where(
        GeofenceAlert.user_id == user.id,
        GeofenceAlert.transition_key == data.transition_key,
    )).first()
    if existing is not None:
        response.status_code = 200
        return public_alert(existing)

    fence = session.get(Geofence, data.geofence_id)
    if fence is None or fence.user_id != user.id:
        raise HTTPException(status_code=404, detail="Geofence not found")
    if not fence.is_active:
        raise HTTPException(status_code=409, detail="Inactive geofences cannot create alerts")
    device = session.get(Device, data.device_id)
    if device is None or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")
    if fence.device_id is not None and fence.device_id != device.id:
        raise HTTPException(status_code=409, detail="Device is not associated with this geofence")

    alert = GeofenceAlert(
        event_type=data.event_type,
        timestamp=datetime.now(timezone.utc),
        transition_key=data.transition_key,
        geofence_id=fence.id,
        geofence_name=fence.name,
        user_id=user.id,
        device_id=device.id,
        device_name=device.name,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    session.add(alert)
    try:
        session.commit()
        session.refresh(alert)
    except IntegrityError:
        session.rollback()
        existing = session.exec(select(GeofenceAlert).where(
            GeofenceAlert.user_id == user.id,
            GeofenceAlert.transition_key == data.transition_key,
        )).first()
        if existing is None:
            raise
        response.status_code = 200
        return public_alert(existing)

    response.status_code = 201
    return public_alert(alert)
