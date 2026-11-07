import API from './api';
import { createAlert, getAlerts } from './alerts';

jest.mock('./api', () => ({ get: jest.fn(), post: jest.fn() }));

test('loads and normalizes a bounded alert history', async () => {
  API.get.mockResolvedValue({ data: [{ id: 1, event_type: 'EXIT', geofence_name: 'Campus', device_name: 'Van', latitude: 13, longitude: 77, timestamp: '2026-10-23T10:00:00Z' }] });
  const alerts = await getAlerts();
  expect(API.get).toHaveBeenCalledWith('/alerts', { params: { limit: 100 } });
  expect(alerts[0]).toMatchObject({ type: 'EXIT', tone: 'warning', title: 'Exited safe zone', fence: 'Campus', device: 'Van', lat: 13, lon: 77 });
});

test('persists only transition metadata through the authenticated API client', async () => {
  const event = { id: 'transition-a', type: 'ENTER', geofence_id: 2, device_id: 3, lat: 13, lon: 77 };
  API.post.mockResolvedValue({ data: { id: 9, event_type: 'ENTER', geofence_id: 2, geofence_name: 'Campus', device_id: 3, device_name: 'Van', latitude: 13, longitude: 77, timestamp: '2026-10-23T10:00:00Z', transition_key: event.id } });
  const saved = await createAlert(event);
  expect(API.post).toHaveBeenCalledWith('/alerts', { event_type: 'ENTER', transition_key: 'transition-a', geofence_id: 2, device_id: 3, latitude: 13, longitude: 77 });
  expect(saved).toMatchObject({ id: 9, type: 'ENTER', tone: 'safe', fence: 'Campus' });
});
