from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import create_db
from config import validate_auth_config
from routers.tracking import router as tracking_router
from routers.geofence import router as geofence_router
from routers.devices import router as devices_router
from routers.users import router as user_router
from routers.telemetry import router as telemetry_router
from routers.geofences import router as geofences_router
from routers.alerts import router as alerts_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_config()
    create_db()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/")
def root():
    return {"message": "Backend running"}

app.include_router(tracking_router, prefix="/tracking")
app.include_router(geofence_router, prefix="/geofence")
app.include_router(devices_router, prefix="/devices")
app.include_router(user_router, prefix="/users")
app.include_router(telemetry_router, prefix="/telemetry")
app.include_router(geofences_router, prefix="/geofences", tags=["geofences"])
app.include_router(alerts_router, prefix="/alerts", tags=["alerts"])

