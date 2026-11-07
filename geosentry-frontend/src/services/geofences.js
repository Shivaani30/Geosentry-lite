import API from './api';

function normalizeGeofence(fence) {
  return {
    ...fence,
    center: fence.center || { lat: Number(fence.latitude), lng: Number(fence.longitude) },
    radius: Number(fence.radius),
    active: fence.is_active ?? fence.active ?? true,
    is_active: fence.is_active ?? fence.active ?? true,
  };
}

function toPayload(fence) {
  return {
    name: fence.name,
    latitude: fence.center.lat,
    longitude: fence.center.lng,
    radius: fence.radius,
    is_active: fence.is_active ?? fence.active ?? true,
    device_id: fence.device_id ?? null,
  };
}

export async function getGeofences() {
  const { data } = await API.get('/geofences');
  if (!Array.isArray(data)) throw new Error('Unexpected geofence response');
  return data.map(normalizeGeofence);
}

export async function createGeofence(fence) {
  const { data } = await API.post('/geofences', toPayload(fence));
  return normalizeGeofence(data);
}

export async function updateGeofence(id, fence) {
  const { data } = await API.put(`/geofences/${id}`, toPayload(fence));
  return normalizeGeofence(data);
}

export async function deleteGeofence(id) {
  await API.delete(`/geofences/${id}`);
}
