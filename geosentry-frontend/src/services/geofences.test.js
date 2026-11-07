import API from './api';
import { createGeofence, deleteGeofence, getGeofences, updateGeofence } from './geofences';

jest.mock('./api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));

test('loads and normalizes persistent geofence records', async () => {
  API.get.mockResolvedValue({ data: [{ id: 5, name: 'Campus', latitude: 13, longitude: 77, radius: 300, is_active: false }] });
  await expect(getGeofences()).resolves.toEqual([expect.objectContaining({ id: 5, center: { lat: 13, lng: 77 }, active: false })]);
  expect(API.get).toHaveBeenCalledWith('/geofences');
});

test('creates and updates geofences with backend field names and optional device association', async () => {
  const fence = { name: 'Office', center: { lat: 13, lng: 77 }, radius: 250, is_active: false };
  API.post.mockResolvedValue({ data: { id: 2, ...fence, latitude: 13, longitude: 77 } });
  API.put.mockResolvedValue({ data: { id: 2, ...fence, latitude: 13, longitude: 77 } });
  await createGeofence(fence);
  await updateGeofence(2, fence);
  const expected = { name: 'Office', latitude: 13, longitude: 77, radius: 250, is_active: false, device_id: null };
  expect(API.post).toHaveBeenCalledWith('/geofences', expected);
  expect(API.put).toHaveBeenCalledWith('/geofences/2', expected);
});

test('deletes the requested saved geofence', async () => {
  API.delete.mockResolvedValue({ data: { deleted: true } });
  await deleteGeofence(7);
  expect(API.delete).toHaveBeenCalledWith('/geofences/7');
});
