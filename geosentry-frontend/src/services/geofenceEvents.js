import { isInsideGeofence } from './geofence';

function hasValidPosition(device) {
  return device?.hasLocation && Number.isFinite(device.lat) && Number.isFinite(device.lon) &&
    Math.abs(device.lat) <= 90 && Math.abs(device.lon) <= 180;
}

/** Calculate current fence states and emit events only for established-state transitions. */
export function evaluateGeofenceTransitions(previousStates, devices, geofences, timestamp = new Date().toISOString()) {
  const states = {};
  const events = [];

  devices.filter(hasValidPosition).forEach(device => {
    geofences.filter(fence => fence.active !== false).forEach(fence => {
      const key = `${device.id}:${fence.id}`;
      const inside = isInsideGeofence(device.lat, device.lon, fence.center, fence.radius / 1000);
      states[key] = inside;

      if (Object.prototype.hasOwnProperty.call(previousStates, key) && previousStates[key] !== inside) {
        const entered = inside;
        events.push({
          id: `${key}:${timestamp}:${events.length}`,
          type: entered ? 'ENTER' : 'EXIT',
          device_id: device.id,
          geofence_id: fence.id,
          device: device.name || `Device ${device.id}`,
          fence: fence.name,
          lat: device.lat,
          lon: device.lon,
          time: timestamp,
          tone: entered ? 'safe' : 'warning',
          title: entered ? 'Entered safe zone' : 'Exited safe zone',
        });
      }
    });
  });

  return { states, events };
}
