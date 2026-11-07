import { evaluateGeofenceTransitions } from './geofenceEvents';

const fence = { id: 'office', name: 'Office', center: { lat: 13, lng: 77 }, radius: 250 };
const deviceAt = (lat, lon = 77) => ({ id: 4, name: 'Van 4', lat, lon, hasLocation: true });
const timestamp = '2026-10-23T10:00:00.000Z';

test('classifies positions inside and outside a configured radius', () => {
  const outside = evaluateGeofenceTransitions({}, [deviceAt(13.01)], [fence], timestamp);
  const inside = evaluateGeofenceTransitions({}, [deviceAt(13.0005)], [fence], timestamp);

  expect(outside.states['4:office']).toBe(false);
  expect(inside.states['4:office']).toBe(true);
  expect(outside.events).toHaveLength(0);
  expect(inside.events).toHaveLength(0);
});

test('emits one ENTER on outside-to-inside and no duplicate while still inside', () => {
  const outside = evaluateGeofenceTransitions({}, [deviceAt(13.01)], [fence], timestamp);
  const entered = evaluateGeofenceTransitions(outside.states, [deviceAt(13.0005)], [fence], timestamp);
  const stillInside = evaluateGeofenceTransitions(entered.states, [deviceAt(13.0004)], [fence], timestamp);

  expect(entered.events).toHaveLength(1);
  expect(entered.events[0]).toMatchObject({ type: 'ENTER', title: 'Entered safe zone', device: 'Van 4', fence: 'Office' });
  expect(stillInside.events).toHaveLength(0);
});

test('emits one EXIT on inside-to-outside and no duplicate while still outside', () => {
  const inside = evaluateGeofenceTransitions({}, [deviceAt(13.0005)], [fence], timestamp);
  const exited = evaluateGeofenceTransitions(inside.states, [deviceAt(13.01)], [fence], timestamp);
  const stillOutside = evaluateGeofenceTransitions(exited.states, [deviceAt(13.02)], [fence], timestamp);

  expect(exited.events).toHaveLength(1);
  expect(exited.events[0]).toMatchObject({ type: 'EXIT', title: 'Exited safe zone', device: 'Van 4', fence: 'Office' });
  expect(stillOutside.events).toHaveLength(0);
});

test('ignores invalid coordinates and inactive fences', () => {
  const result = evaluateGeofenceTransitions({}, [deviceAt(91)], [{ ...fence, active: false }], timestamp);
  expect(result.states).toEqual({});
  expect(result.events).toEqual([]);
});
