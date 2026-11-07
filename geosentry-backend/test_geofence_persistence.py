import unittest

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine, select

import database
from main import app
from models import Device, GeofenceAlert


class PersistentGeofenceApiTests(unittest.TestCase):
    def setUp(self):
        self.original_engine = database.engine
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        database.engine = self.engine
        self.client = TestClient(app)
        self.client.__enter__()
        self.headers_a = self._create_user("owner-a")
        self.headers_b = self._create_user("owner-b")
        with Session(self.engine) as session:
            device = Device(name="Vehicle A", latitude=13.0, longitude=77.0, user_id=1)
            session.add(device)
            session.commit()
            session.refresh(device)
            self.device_id = device.id

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.engine.dispose()
        database.engine = self.original_engine

    def _create_user(self, username):
        credentials = {"username": username, "password": "safe-test-password"}
        response = self.client.post("/users/signup", json=credentials)
        self.assertEqual(response.status_code, 200)
        token = self.client.post("/users/login", json=credentials).json()["token"]
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def _fence_payload(**overrides):
        return {
            "name": "  Campus  ",
            "latitude": 13.0,
            "longitude": 77.0,
            "radius": 250,
            "is_active": True,
            "device_id": None,
            **overrides,
        }

    def _create_fence(self, **overrides):
        response = self.client.post("/geofences", headers=self.headers_a, json=self._fence_payload(**overrides))
        self.assertEqual(response.status_code, 201)
        return response.json()

    def _alert_payload(self, fence_id, key, event_type="ENTER", **overrides):
        return {
            "event_type": event_type,
            "transition_key": key,
            "geofence_id": fence_id,
            "device_id": self.device_id,
            "latitude": 13.0,
            "longitude": 77.0,
            **overrides,
        }

    def test_authenticated_geofence_crud_optional_device_validation_and_ownership(self):
        self.assertEqual(self.client.get("/geofences").status_code, 401)
        created = self._create_fence()
        self.assertEqual(created["name"], "Campus")
        self.assertTrue(created["is_active"])
        self.assertEqual(created["center"], {"lat": 13.0, "lng": 77.0})
        self.assertIsNone(created["device_id"])
        fence_id = created["id"]

        listing = self.client.get("/geofences", headers=self.headers_a)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual([item["id"] for item in listing.json()], [fence_id])
        self.assertEqual(self.client.get(f"/geofences/{fence_id}", headers=self.headers_a).status_code, 200)

        update = self.client.put(f"/geofences/{fence_id}", headers=self.headers_a, json=self._fence_payload(
            name="Warehouse", latitude=14.0, longitude=78.0, radius=900, is_active=False, device_id=self.device_id,
        ))
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.json()["name"], "Warehouse")
        self.assertFalse(update.json()["is_active"])
        self.assertEqual(update.json()["device_id"], self.device_id)

        self.assertEqual(self.client.get("/geofences", headers=self.headers_b).json(), [])
        self.assertEqual(self.client.get(f"/geofences/{fence_id}", headers=self.headers_b).status_code, 404)
        self.assertEqual(self.client.put(f"/geofences/{fence_id}", headers=self.headers_b, json=self._fence_payload()).status_code, 404)
        self.assertEqual(self.client.delete(f"/geofences/{fence_id}", headers=self.headers_b).status_code, 404)
        foreign_device = self.client.post("/geofences", headers=self.headers_b, json=self._fence_payload(device_id=self.device_id))
        self.assertEqual(foreign_device.status_code, 404)

        for payload in (
            self._fence_payload(latitude=90.1),
            self._fence_payload(longitude=-180.1),
            self._fence_payload(radius=0),
            self._fence_payload(radius=100001),
            self._fence_payload(name="   "),
        ):
            self.assertEqual(self.client.post("/geofences", headers=self.headers_a, json=payload).status_code, 422)

        self.assertEqual(self.client.delete(f"/geofences/{fence_id}", headers=self.headers_a).status_code, 200)
        self.assertEqual(self.client.get("/geofences", headers=self.headers_a).json(), [])

    def test_persistent_transition_alerts_are_idempotent_and_user_scoped(self):
        fence = self._create_fence()
        first = self.client.post("/alerts", headers=self.headers_a, json=self._alert_payload(fence["id"], "device-1:fence-1:crossing-a"))
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["event_type"], "ENTER")
        repeated = self.client.post("/alerts", headers=self.headers_a, json=self._alert_payload(fence["id"], "device-1:fence-1:crossing-a"))
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.json()["id"], first.json()["id"])

        exited = self.client.post("/alerts", headers=self.headers_a, json=self._alert_payload(fence["id"], "device-1:fence-1:crossing-b", event_type="EXIT"))
        self.assertEqual(exited.status_code, 201)
        history = self.client.get("/alerts?limit=50", headers=self.headers_a)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.json()), 2)
        self.assertEqual(self.client.get("/alerts?event_type=EXIT", headers=self.headers_a).json()[0]["event_type"], "EXIT")
        self.assertEqual(self.client.get("/alerts", headers=self.headers_b).json(), [])
        self.assertEqual(self.client.get(f"/alerts/{first.json()['id']}", headers=self.headers_b).status_code, 404)
        self.assertEqual(self.client.post("/alerts", headers=self.headers_b, json=self._alert_payload(fence["id"], "foreign-event")).status_code, 404)

        self.assertEqual(self.client.delete(f"/geofences/{fence['id']}", headers=self.headers_a).status_code, 200)
        retained = self.client.get("/alerts", headers=self.headers_a).json()
        self.assertEqual(len(retained), 2)
        self.assertTrue(all(item["geofence_name"] == "Campus" for item in retained))
        with Session(self.engine) as session:
            self.assertEqual(len(session.exec(select(GeofenceAlert)).all()), 2)

    def test_inactive_geofence_rejects_new_boundary_alert(self):
        fence = self._create_fence(is_active=False)
        response = self.client.post("/alerts", headers=self.headers_a, json=self._alert_payload(fence["id"], "inactive-crossing"))
        self.assertEqual(response.status_code, 409)

    def test_multiple_geofences_persist_and_are_returned_to_owner(self):
        self._create_fence(name="Campus")
        self._create_fence(name="Warehouse", latitude=14.0, longitude=78.0)

        refreshed = self.client.get("/geofences", headers=self.headers_a)
        self.assertEqual(refreshed.status_code, 200)
        self.assertEqual({item["name"] for item in refreshed.json()}, {"Campus", "Warehouse"})
        self.assertEqual(self.client.get("/geofences", headers=self.headers_b).json(), [])


if __name__ == "__main__":
    unittest.main()
