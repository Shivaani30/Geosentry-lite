import unittest
import os
from unittest.mock import AsyncMock, patch

import httpx

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import create_engine

import database
from main import app
from telemetry_service import build_telemetry_request, fetch_telemetry, parse_telemetry
from config import get_jwt_secret


class TelemetryParsingTests(unittest.IsolatedAsyncioTestCase):
    def test_jwt_signing_fails_closed_without_a_strong_configured_secret(self):
        for value in ("", "too-short"):
            with patch.dict(os.environ, {"GEOSENTRY_JWT_SECRET": value}):
                with self.assertRaises(RuntimeError):
                    get_jwt_secret()

    def test_uses_latest_valid_item_and_supported_coordinate_names(self):
        result = parse_telemetry([
            {"latitude": "12.5", "longitude": "77.2", "timestamp": "older"},
            {"Lat": 13, "Lon": 78, "speed": 26, "timestamp": "newer"},
        ])
        self.assertEqual(result["lat"], 13)
        self.assertEqual(result["lng"], 78)
        self.assertEqual(result["speed"], 26)
        self.assertEqual(result["timestamp"], "newer")

    def test_rejects_invalid_coordinates(self):
        with self.assertRaises(Exception):
            parse_telemetry({"lat": 91, "lon": 77})

    def test_provider_must_be_configured_instead_of_using_a_stale_default(self):
        with patch.dict(os.environ, {"TELEMETRY_BASE_URL": "", "GEOSENTRY_TELEMETRY_API_BASE_URL": ""}, clear=True):
            with self.assertRaises(Exception) as raised:
                build_telemetry_request("device-id")
        self.assertEqual(raised.exception.status_code, 503)

    def test_provider_url_and_path_are_configurable_and_identifier_is_encoded(self):
        values = {
            "TELEMETRY_BASE_URL": "https://gps.example.test/v2/positions/",
            "TELEMETRY_PATH_TEMPLATE": "/{external_id}",
            "TELEMETRY_TIMEOUT_SECONDS": "7",
        }
        with patch.dict(os.environ, values, clear=True):
            url, timeout = build_telemetry_request("vehicle/42")
        self.assertEqual(url, "https://gps.example.test/v2/positions/vehicle%2F42")
        self.assertEqual(timeout, 7)

    async def test_configured_provider_response_is_normalized_by_adapter(self):
        values = {
            "TELEMETRY_BASE_URL": "https://gps.example.test/api/telemetry",
            "TELEMETRY_PATH_TEMPLATE": "/{external_id}",
            "TELEMETRY_TIMEOUT_SECONDS": "7",
        }
        observed_urls = []
        transport = httpx.MockTransport(lambda request: (
            observed_urls.append(str(request.url)) or
            httpx.Response(200, json={"Latitude": "13.2", "Longitude": "77.8", "time": "2026-10-23T10:00:00Z"})
        ))
        real_client = httpx.AsyncClient
        with patch.dict(os.environ, values, clear=True), patch(
            "telemetry_service.httpx.AsyncClient",
            side_effect=lambda **kwargs: real_client(transport=transport, **kwargs),
        ):
            result = await fetch_telemetry("vehicle-42")
        self.assertEqual(observed_urls, ["https://gps.example.test/api/telemetry/vehicle-42"])
        self.assertEqual(result["lat"], 13.2)
        self.assertEqual(result["lng"], 77.8)
        self.assertEqual(result["time"], "2026-10-23T10:00:00Z")


class LocalApiTests(unittest.TestCase):
    def test_local_flow_and_telemetry_proxy(self):
        original = database.engine
        database.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        try:
            with TestClient(app) as client:
                self.assertEqual(client.get("/").status_code, 200)
                self.assertEqual(client.get("/docs").status_code, 200)
                self.assertEqual(client.get("/tracking/devices_location").status_code, 401)
                credentials = {"username": "smoke-test", "password": "local-test-password"}
                self.assertEqual(client.post("/users/signup", json=credentials).status_code, 200)
                self.assertEqual(client.post("/users/signup", json=credentials).status_code, 409)
                token = client.post("/users/login", json=credentials).json()["token"]
                headers = {"Authorization": f"Bearer {token}"}
                self.assertEqual(client.post("/users/login", json={**credentials, "password": "wrong"}).status_code, 401)
                for origin in ["http://localhost:3000", "http://127.0.0.1:3000"]:
                    response = client.options("/users/login", headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization"})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.headers["access-control-allow-origin"], origin)
                self.assertEqual(client.post("/devices/add", json={"name": "Test vehicle", "latitude": 13.0, "longitude": 77.7}).status_code, 401)
                spoofed = client.post("/devices/add", headers=headers, json={"name": "Test vehicle", "latitude": 13.0, "longitude": 77.7, "user_id": 999, "external_id": "must-not-be-accepted"})
                self.assertEqual(spoofed.status_code, 422)
                added = client.post("/devices/add", headers=headers, json={"name": "Test vehicle", "latitude": 13.0, "longitude": 77.7})
                self.assertEqual(added.status_code, 200)
                self.assertEqual(added.json()["user_id"], 1)
                self.assertNotIn("external_id", added.json())
                devices = client.get("/tracking/devices_location", headers=headers).json()
                self.assertEqual(len(devices), 1)
                self.assertEqual(devices[0]["latitude"], 13.0)
                self.assertFalse(devices[0]["telemetry_available"])
                self.assertEqual(client.post("/tracking/update_location?device_id=1&latitude=13.01&longitude=77.71").status_code, 401)
                update = client.post("/tracking/update_location?device_id=1&latitude=13.01&longitude=77.71", headers=headers)
                self.assertEqual(update.status_code, 200)
                self.assertNotIn("external_id", update.json()["device"])
                updated = client.get("/tracking/devices_location", headers=headers).json()[0]
                self.assertEqual(updated["latitude"], 13.01)
                self.assertEqual(updated["longitude"], 77.71)
                self.assertNotIn("external_id", updated)
                self.assertEqual(client.post("/devices/update/999?lat=0&lon=0", headers=headers).status_code, 404)
                self.assertEqual(client.post("/devices/update/1?lat=91&lon=0", headers=headers).status_code, 422)
                self.assertEqual(client.post("/tracking/update_location?device_id=1&latitude=0&longitude=181", headers=headers).status_code, 422)
                other = {"username": "other-user", "password": "other-test-password"}
                self.assertEqual(client.post("/users/signup", json=other).status_code, 200)
                other_token = client.post("/users/login", json=other).json()["token"]
                other_headers = {"Authorization": f"Bearer {other_token}"}
                self.assertEqual(client.post("/devices/update/1?lat=14&lon=78", headers=other_headers).status_code, 404)
                self.assertEqual(client.post("/tracking/update_location?device_id=1&latitude=14&longitude=78", headers=other_headers).status_code, 404)
                self.assertEqual(client.get("/devices/all", headers=other_headers).json(), [])
                self.assertEqual(client.get("/telemetry/1", headers=headers).status_code, 409)

                # Test the authenticated proxy and shared location feed with real-shaped telemetry.
                from sqlmodel import Session
                from models import Device
                with Session(database.engine) as session:
                    device = session.get(Device, 1)
                    device.external_id = "provider-id-test"
                    session.add(device)
                    session.commit()
                payload = {"latitude": 13.2, "longitude": 77.8, "timestamp": "2026-10-22T12:00:00Z", "speed": 12}
                with patch("routers.telemetry.fetch_telemetry", new=AsyncMock(return_value={"lat": 13.2, "lng": 77.8, "timestamp": payload["timestamp"], "speed": 12})):
                    proxy = client.get("/telemetry/1", headers=headers)
                    self.assertEqual(proxy.status_code, 200)
                    self.assertEqual(proxy.json()["lat"], 13.2)
                with patch("routers.telemetry.fetch_telemetry", new=AsyncMock(return_value={"lat": 13.3, "lng": 77.9, "timestamp": payload["timestamp"], "speed": 13})):
                    feed = client.get("/tracking/devices_location", headers=headers)
                    self.assertEqual(feed.status_code, 200)
                    self.assertEqual(feed.json()[0]["latitude"], 13.3)
                    self.assertEqual(feed.json()[0]["longitude"], 77.9)
                    self.assertEqual(feed.json()[0]["speed"], 13)
                    self.assertNotIn("external_id", feed.json()[0])
                from fastapi import HTTPException
                with patch("routers.telemetry.fetch_telemetry", new=AsyncMock(side_effect=HTTPException(status_code=503, detail="Telemetry provider is not configured"))):
                    unavailable = client.get("/tracking/devices_location", headers=headers)
                self.assertEqual(unavailable.status_code, 200)
                self.assertIsNone(unavailable.json()[0]["latitude"])
                self.assertFalse(unavailable.json()[0]["telemetry_available"])
                with patch("routers.devices.fetch_telemetry", new=AsyncMock(return_value={"lat": 13.4, "lng": 78.0})):
                    registered = client.post("/devices/register-telemetry", headers=headers, json={"name": "GPS vehicle", "external_id": "provider-id-test"})
                self.assertEqual(registered.status_code, 200)
                self.assertEqual(registered.json()["lat"], 13.4)
                self.assertNotIn("external_id", registered.json())
        finally:
            database.engine.dispose()
            database.engine = original


if __name__ == "__main__":
    unittest.main()
