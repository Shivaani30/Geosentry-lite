from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    password: str

class Device(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    latitude: float
    longitude: float
    user_id: int
    # Stored only by the backend; API responses expose a configured flag, never this value.
    external_id: Optional[str] = None


class Geofence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=80)
    latitude: float
    longitude: float
    radius: float
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: int = Field(foreign_key="user.id", index=True)
    device_id: Optional[int] = Field(default=None, foreign_key="device.id", index=True)


class GeofenceAlert(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "transition_key", name="uq_alert_user_transition"),
        CheckConstraint("event_type IN ('ENTER', 'EXIT')", name="ck_alert_event_type"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    event_type: str = Field(max_length=5)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    # Keep these as historical snapshots instead of cascading alert history when
    # a fence is removed. Creation still verifies both IDs belong to the user.
    geofence_id: int
    geofence_name: str = Field(max_length=80)
    user_id: int = Field(foreign_key="user.id", index=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    device_name: str = Field(max_length=120)
    latitude: float
    longitude: float
    transition_key: str = Field(max_length=200)
