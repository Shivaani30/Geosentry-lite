import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluateGeofenceTransitions } from '../services/geofenceEvents';
import { isInsideGeofence } from '../services/geofence';
import { buildDemoRoute } from '../services/demoRoute';

const STEP_INTERVAL_MS = 1800;

function makeDemoDevice(fence, point) {
  return {
    id: `demo-${fence.id}`,
    name: 'Simulated demo vehicle',
    lat: point.lat,
    lon: point.lon,
    hasLocation: true,
    isDemo: true,
    telemetry_available: false,
    telemetry_configured: false,
  };
}

export default function useDemoRoute(geofences) {
  const activeGeofences = geofences.filter(fence => fence.active !== false);
  const [selectedFenceId, setSelectedFenceId] = useState('');
  const [running, setRunning] = useState(false);
  const [demoDevice, setDemoDevice] = useState(null);
  const [events, setEvents] = useState([]);
  const [stepIndex, setStepIndex] = useState(-1);
  const routeIndex = useRef(-1);
  const previousStates = useRef({});

  const selectedFence = activeGeofences.find(fence => String(fence.id) === String(selectedFenceId)) || activeGeofences[0] || null;
  const route = useMemo(() => buildDemoRoute(selectedFence), [selectedFence]);

  function resetDemo() {
    setRunning(false);
    setDemoDevice(null);
    setEvents([]);
    setStepIndex(-1);
    routeIndex.current = -1;
    previousStates.current = {};
  }

  function chooseFence(id) {
    resetDemo();
    setSelectedFenceId(id);
  }

  function startDemo() {
    if (!selectedFence || route.length < 2) return;
    if (demoDevice) {
      setRunning(true);
      return;
    }

    const initialPosition = route[0];
    const initialDevice = makeDemoDevice(selectedFence, initialPosition);
    const baseline = evaluateGeofenceTransitions({}, [initialDevice], [selectedFence]);
    previousStates.current = baseline.states;
    routeIndex.current = 0;
    setStepIndex(0);
    setEvents([]);
    setDemoDevice(initialDevice);
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return undefined;
    if (!selectedFence || route.length < 2) {
      setRunning(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      const nextIndex = (routeIndex.current + 1) % route.length;
      routeIndex.current = nextIndex;
      setStepIndex(nextIndex);

      const device = makeDemoDevice(selectedFence, route[nextIndex]);
      const result = evaluateGeofenceTransitions(
        previousStates.current,
        [device],
        [selectedFence],
        new Date().toISOString(),
      );
      previousStates.current = result.states;
      setDemoDevice(device);
      if (result.events.length) {
        setEvents(current => [...result.events, ...current].slice(0, 20));
      }
    }, STEP_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [running, route, selectedFence]);

  const inside = demoDevice && selectedFence
    ? isInsideGeofence(demoDevice.lat, demoDevice.lon, selectedFence.center, selectedFence.radius / 1000)
    : null;

  return {
    activeGeofences,
    selectedFence,
    selectedFenceId: selectedFence?.id ?? '',
    chooseFence,
    running,
    startDemo,
    pauseDemo: () => setRunning(false),
    resetDemo,
    demoDevice,
    events,
    inside,
    stepIndex,
    stepCount: route.length,
  };
}
