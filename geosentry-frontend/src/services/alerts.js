import API from './api';

function normalizeAlert(alert) {
  const entering = alert.event_type === 'ENTER';
  return {
    ...alert,
    type: alert.event_type,
    device: alert.device_name || alert.device,
    fence: alert.geofence_name || alert.fence,
    lat: Number(alert.latitude ?? alert.lat),
    lon: Number(alert.longitude ?? alert.lon),
    time: alert.timestamp || alert.time,
    tone: alert.tone || (entering ? 'safe' : 'warning'),
    title: alert.title || (entering ? 'Entered safe zone' : 'Exited safe zone'),
  };
}

export async function getAlerts(params = {}) {
  const { data } = await API.get('/alerts', { params: { limit: 100, ...params } });
  if (!Array.isArray(data)) throw new Error('Unexpected alert response');
  return data.map(normalizeAlert);
}

export async function createAlert(event) {
  const { data } = await API.post('/alerts', {
    event_type: event.type,
    transition_key: event.id,
    geofence_id: event.geofence_id,
    device_id: event.device_id,
    latitude: event.lat,
    longitude: event.lon,
  });
  return normalizeAlert(data);
}
