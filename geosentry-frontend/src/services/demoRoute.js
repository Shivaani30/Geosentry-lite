const EARTH_RADIUS_METERS = 6371008.8;

function destination(center, bearingDegrees, distanceMeters) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = bearingDegrees * Math.PI / 180;
  const latitude1 = center.lat * Math.PI / 180;
  const longitude1 = center.lng * Math.PI / 180;
  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance) +
    Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude2 = longitude1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
    Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2),
  );

  return {
    lat: latitude2 * 180 / Math.PI,
    lon: ((longitude2 * 180 / Math.PI + 540) % 360) - 180,
  };
}

/** A repeatable, explicitly simulated route that crosses one saved geofence. */
export function buildDemoRoute(fence) {
  if (!fence?.center || !Number.isFinite(fence.radius) || fence.radius <= 0) return [];

  const outsideDistance = fence.radius * 1.5;
  return [
    destination(fence.center, 90, outsideDistance),
    { lat: fence.center.lat, lon: fence.center.lng },
    destination(fence.center, 270, outsideDistance),
    { lat: fence.center.lat, lon: fence.center.lng },
  ];
}
