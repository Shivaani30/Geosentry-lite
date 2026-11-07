import API from './api';
import { getDevices } from './devices';
jest.mock('./api', () => ({ get: jest.fn() }));
test('keeps all devices but rejects missing and out-of-range locations', async () => {
  API.get.mockResolvedValue({ data: [
    { id: 1, latitude: 0, longitude: 0 },
    { id: 2, latitude: null, longitude: null },
    { id: 3, latitude: 91, longitude: 10 },
    { id: 4, latitude: '13.1', longitude: '77.2' },
  ] });
  const devices = await getDevices();
  expect(devices.map(d => d.hasLocation)).toEqual([true, false, false, true]);
  expect(devices[3].lat).toBe(13.1);
  expect(devices[0].speed).toBeUndefined();
  expect(API.get).toHaveBeenCalledWith('/tracking/devices_location');
});
test('invalid API responses fail instead of displaying fabricated data', async () => {
  API.get.mockResolvedValue({ data: { error: 'Unavailable' } });
  await expect(getDevices()).rejects.toThrow('Unexpected device response');
});
