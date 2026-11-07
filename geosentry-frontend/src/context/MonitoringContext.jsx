import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getDevices } from '../services/devices';
import { evaluateGeofenceTransitions } from '../services/geofenceEvents';
import { createGeofence, deleteGeofence as removeGeofence, getGeofences, updateGeofence as saveGeofence } from '../services/geofences';
import { createAlert, getAlerts } from '../services/alerts';

const MonitoringContext = createContext(null);
const MAX_ALERTS = 100;

function mergeAlerts(current, incoming) {
  const unique = new Map();
  [...incoming, ...current].forEach(alert => {
    const key = alert.transition_key || `id:${alert.id}`;
    if (!unique.has(key)) unique.set(key, alert);
  });
  return [...unique.values()]
    .sort((a, b) => new Date(b.time || b.timestamp).getTime() - new Date(a.time || a.timestamp).getTime())
    .slice(0, MAX_ALERTS);
}

function apiError(error, fallback) {
  return error.response?.data?.detail || fallback;
}

export function MonitoringProvider({ children }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState(null);
  const [geofences, setGeofences] = useState([]);
  const [geofenceLoading, setGeofenceLoading] = useState(true);
  const [geofenceError, setGeofenceError] = useState('');
  const [savingGeofence, setSavingGeofence] = useState(false);
  const [deletingGeofenceId, setDeletingGeofenceId] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState('');
  const [toast, setToast] = useState('');
  const inside = useRef({});
  const busy = useRef(false);
  const mounted = useRef(false);
  const pendingAlertEvents = useRef(new Map());
  const persistingAlerts = useRef(false);
  const fenceMutationVersion = useRef(0);
  const alertMutationVersion = useRef(0);

  const persistPendingAlerts = useCallback(async () => {
    if (persistingAlerts.current || pendingAlertEvents.current.size === 0) return;
    persistingAlerts.current = true;
    try {
      for (const [key, event] of pendingAlertEvents.current) {
        try {
          const saved = await createAlert(event);
          pendingAlertEvents.current.delete(key);
          alertMutationVersion.current += 1;
          if (mounted.current) {
            setAlerts(current => mergeAlerts(current, [saved]));
            setAlertsError('');
          }
        } catch (err) {
          if (mounted.current) setAlertsError(apiError(err, 'Could not save a geofence event. GeoSentry will retry on the next location update.'));
          break;
        }
      }
    } finally {
      persistingAlerts.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const data = await getDevices();
      if (mounted.current) { setDevices(data); setError(''); setLastFetched(new Date()); }
      void persistPendingAlerts();
    } catch (err) {
      if (mounted.current) setError(err.response ? `Device data is unavailable (HTTP ${err.response.status}). Please try again.` : 'Unable to connect to GeoSentry. Check that the server is available and try again.');
    } finally {
      busy.current = false;
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, [persistPendingAlerts]);

  const refreshGeofences = useCallback(async () => {
    const version = fenceMutationVersion.current;
    setGeofenceLoading(true);
    try {
      const data = await getGeofences();
      if (mounted.current && version === fenceMutationVersion.current) { setGeofences(data); setGeofenceError(''); }
    } catch (err) {
      if (mounted.current) setGeofenceError(apiError(err, 'Could not load geofences. Please try again.'));
    } finally {
      if (mounted.current) setGeofenceLoading(false);
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    const version = alertMutationVersion.current;
    setAlertsLoading(true);
    try {
      const data = await getAlerts({ limit: MAX_ALERTS });
      if (mounted.current && version === alertMutationVersion.current) { setAlerts(current => mergeAlerts(current, data)); setAlertsError(''); }
    } catch (err) {
      if (mounted.current) setAlertsError(apiError(err, 'Could not load alert history. Please try again.'));
    } finally {
      if (mounted.current) setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    refreshGeofences();
    refreshAlerts();
    const timer = setInterval(refresh, 5000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [refresh, refreshGeofences, refreshAlerts]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (error || loading || geofenceLoading) return;
    const result = evaluateGeofenceTransitions(inside.current, devices, geofences);
    inside.current = result.states;
    if (result.events.length) {
      const pending = result.events.map(event => ({ ...event, transition_key: event.id, pending: true }));
      pending.forEach(event => pendingAlertEvents.current.set(event.id, event));
      setAlerts(current => mergeAlerts(current, pending));
      void persistPendingAlerts();
    }
  }, [devices, geofences, error, loading, geofenceLoading, persistPendingAlerts]);

  async function addFence(fence) {
    setSavingGeofence(true);
    setGeofenceError('');
    try {
      const saved = await createGeofence(fence);
      fenceMutationVersion.current += 1;
      setGeofences(current => [...current, saved]);
      setToast('Geofence saved.');
      return saved;
    } catch (err) {
      setGeofenceError(apiError(err, 'Could not save geofence. Please try again.'));
      throw err;
    } finally { setSavingGeofence(false); }
  }

  async function updateFence(id, fence) {
    setSavingGeofence(true);
    setGeofenceError('');
    try {
      const saved = await saveGeofence(id, fence);
      fenceMutationVersion.current += 1;
      Object.keys(inside.current).forEach(key => { if (key.endsWith(`:${id}`)) delete inside.current[key]; });
      setGeofences(current => current.map(item => String(item.id) === String(id) ? saved : item));
      setToast('Geofence updated.');
      return saved;
    } catch (err) {
      setGeofenceError(apiError(err, 'Could not update geofence. Please try again.'));
      throw err;
    } finally { setSavingGeofence(false); }
  }

  async function deleteFence(id) {
    setDeletingGeofenceId(id);
    setGeofenceError('');
    try {
      await removeGeofence(id);
      fenceMutationVersion.current += 1;
      Object.keys(inside.current).forEach(key => { if (key.endsWith(`:${id}`)) delete inside.current[key]; });
      setGeofences(current => current.filter(item => String(item.id) !== String(id)));
      setToast('Geofence deleted. Alert history is retained.');
    } catch (err) {
      setGeofenceError(apiError(err, 'Could not delete geofence. Please try again.'));
      throw err;
    } finally { setDeletingGeofenceId(null); }
  }

  return <MonitoringContext.Provider value={{
    devices, loading, refreshing, error, lastFetched, refresh,
    geofences, geofenceLoading, geofenceError, refreshGeofences, savingGeofence, deletingGeofenceId,
    addFence, updateFence, deleteFence,
    alerts, alertsLoading, alertsError, refreshAlerts, toast, setToast,
  }}>{children}</MonitoringContext.Provider>;
}

export function useMonitoring() { return useContext(MonitoringContext); }
