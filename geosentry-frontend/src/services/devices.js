import API from './api';

// The local backend returns a list of devices with latitude/longitude fields.
export async function getDevices() {
  const { data } = await API.get('/tracking/devices_location');
  if (!Array.isArray(data)) throw new Error('Unexpected device response');
  return data.map(device => {
    const lat = device.latitude == null || device.latitude === '' ? NaN : Number(device.latitude);
    const lon = device.longitude == null || device.longitude === '' ? NaN : Number(device.longitude);
    const hasLocation = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180;
    return { ...device, timestamp: device.timestamp ?? device.time, imei: device.name || device.id, lat, lon, hasLocation };
  });
}

export async function getVehicle() {
  const devices = await getDevices();
  return devices.find(device => device.hasLocation) || null;
}
