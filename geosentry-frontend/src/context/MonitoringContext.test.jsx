import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MonitoringProvider, useMonitoring } from './MonitoringContext';
import { getDevices } from '../services/devices';
import { createGeofence, deleteGeofence, getGeofences, updateGeofence } from '../services/geofences';
import { createAlert, getAlerts } from '../services/alerts';

jest.mock('../services/devices', () => ({ getDevices: jest.fn() }));
jest.mock('../services/geofences', () => ({ getGeofences: jest.fn(), createGeofence: jest.fn(), updateGeofence: jest.fn(), deleteGeofence: jest.fn() }));
jest.mock('../services/alerts', () => ({ getAlerts: jest.fn(), createAlert: jest.fn() }));

function Probe() {
  const context = useMonitoring();
  return <>
    <span data-testid="loading">{String(context.loading)}</span>
    <span data-testid="error">{context.error}</span>
    <span data-testid="fence-loading">{String(context.geofenceLoading)}</span>
    <span data-testid="device-count">{context.devices.length}</span>
    <span data-testid="fences">{context.geofences.map(fence => fence.name).join(',')}</span>
    <span data-testid="alerts">{context.alerts.map(alert => alert.title).join(',')}</span>
    <span data-testid="fence-error">{context.geofenceError}</span>
    <span data-testid="alert-error">{context.alertsError}</span>
    <button onClick={() => context.addFence({ name: 'Office', center: { lat: 13, lng: 77 }, radius: 200 })}>Add zone</button>
    <button onClick={() => context.updateFence(9, { name: 'Changed', center: { lat: 13, lng: 77 }, radius: 200 }).catch(() => {})}>Update zone</button>
    <button onClick={() => context.deleteFence(9)}>Delete zone</button>
    <button onClick={context.refresh}>Refresh</button>
  </>;
}

const device = { id: 1, name: 'Test vehicle', lat: 13, lon: 77, hasLocation: true };
const fence = { id: 9, name: 'Office', center: { lat: 13, lng: 77 }, radius: 200, active: true, is_active: true };
const storedAlert = { id: 31, event_type: 'ENTER', transition_key: 'saved-event', title: 'Entered safe zone', tone: 'safe', device: 'Test vehicle', fence: 'Office', lat: 13, lon: 77, time: '2026-10-23T10:00:00Z' };

beforeEach(() => {
  jest.clearAllMocks();
  let persistedAlertId = 100;
  getDevices.mockResolvedValue([device]);
  getGeofences.mockResolvedValue([]);
  getAlerts.mockResolvedValue([]);
  createGeofence.mockImplementation(async value => ({ ...value, id: 9, active: true, is_active: true }));
  updateGeofence.mockImplementation(async (id, value) => ({ ...value, id, active: value.is_active ?? true }));
  deleteGeofence.mockResolvedValue(undefined);
  createAlert.mockImplementation(async event => ({ ...event, id: persistedAlertId++, transition_key: event.id, pending: false }));
});

test('loads saved geofences and alert history from the API on mount', async () => {
  getGeofences.mockResolvedValue([fence]);
  getAlerts.mockResolvedValue([storedAlert]);
  render(<MonitoringProvider><Probe /></MonitoringProvider>);
  await waitFor(() => expect(screen.getByTestId('fences').textContent).toBe('Office'));
  await waitFor(() => expect(screen.getByTestId('alerts').textContent).toBe('Entered safe zone'));
  expect(getGeofences).toHaveBeenCalledTimes(1);
  expect(getAlerts).toHaveBeenCalledWith({ limit: 100 });
});

test('creates, updates, and deletes geofences through the API before changing shared state', async () => {
  render(<MonitoringProvider><Probe /></MonitoringProvider>);
  await waitFor(() => expect(screen.getByTestId('fence-loading').textContent).toBe('false'));

  fireEvent.click(screen.getByText('Add zone'));
  await waitFor(() => expect(screen.getByTestId('fences').textContent).toBe('Office'));
  expect(createGeofence).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByText('Update zone'));
  await waitFor(() => expect(screen.getByTestId('fences').textContent).toBe('Changed'));
  expect(updateGeofence).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByText('Delete zone'));
  await waitFor(() => expect(screen.getByTestId('fences').textContent).toBe(''));
  expect(deleteGeofence).toHaveBeenCalledWith(9);
});

test('persists only outside/inside transitions and does not duplicate steady-state alerts', async () => {
  render(<MonitoringProvider><Probe /></MonitoringProvider>);
  await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  await waitFor(() => expect(screen.getByTestId('fence-loading').textContent).toBe('false'));
  fireEvent.click(screen.getByText('Add zone'));
  await waitFor(() => expect(screen.getByTestId('fences').textContent).toBe('Office'));
  expect(screen.getByTestId('alerts').textContent).toBe('');

  getDevices.mockResolvedValue([{ ...device, lat: 14 }]);
  fireEvent.click(screen.getByText('Refresh'));
  await waitFor(() => expect(createAlert).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId('alerts').textContent).toBe('Exited safe zone'));

  getDevices.mockResolvedValue([{ ...device, lat: 14 }]);
  fireEvent.click(screen.getByText('Refresh'));
  await waitFor(() => expect(screen.getByTestId('device-count').textContent).toBe('1'));
  expect(createAlert).toHaveBeenCalledTimes(1);

  getDevices.mockResolvedValue([device]);
  fireEvent.click(screen.getByText('Refresh'));
  await waitFor(() => expect(createAlert).toHaveBeenCalledTimes(2));
  expect(createAlert.mock.calls.map(([event]) => event.type)).toEqual(['EXIT', 'ENTER']);
});

test('failed geofence updates leave the existing saved representation intact', async () => {
  render(<MonitoringProvider><Probe /></MonitoringProvider>);
  await waitFor(() => expect(screen.getByTestId('fence-loading').textContent).toBe('false'));
  fireEvent.click(screen.getByText('Add zone'));
  await waitFor(() => expect(screen.getByTestId('fences').textContent).toBe('Office'));
  updateGeofence.mockRejectedValueOnce({ response: { data: { detail: 'Could not update geofence.' } } });
  fireEvent.click(screen.getByText('Update zone'));
  await waitFor(() => expect(screen.getByTestId('fence-error').textContent).toBe('Could not update geofence.'));
  expect(screen.getByTestId('fences').textContent).toBe('Office');
});

test('retains last-known device data on connection failure and clearly reports the failure', async () => {
  render(<MonitoringProvider><Probe /></MonitoringProvider>);
  await waitFor(() => expect(screen.getByTestId('device-count').textContent).toBe('1'));
  getDevices.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByText('Refresh'));
  await waitFor(() => expect(screen.getByTestId('error').textContent).toContain('Unable to connect'));
  expect(screen.getByTestId('device-count').textContent).toBe('1');
});
