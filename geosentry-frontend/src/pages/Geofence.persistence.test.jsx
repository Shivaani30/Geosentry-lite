import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Geofence from './Geofence';
import { MonitoringProvider } from '../context/MonitoringContext';
import { getDevices } from '../services/devices';
import { getGeofences } from '../services/geofences';
import { getAlerts } from '../services/alerts';

jest.mock('../services/devices', () => ({ getDevices: jest.fn() }));
jest.mock('../services/geofences', () => ({ getGeofences: jest.fn(), createGeofence: jest.fn(), updateGeofence: jest.fn(), deleteGeofence: jest.fn() }));
jest.mock('../services/alerts', () => ({ getAlerts: jest.fn(), createAlert: jest.fn() }));
jest.mock('../components/LocationMap', () => function MapPreview({ devices = [], geofences = [] }) {
  return <div data-testid="map-preview" data-devices={devices.filter(device => device.hasLocation).length} data-geofences={geofences.length} />;
});

test('shows persisted fences and alerts without inventing a vehicle when telemetry is absent', async () => {
  getDevices.mockResolvedValue([]);
  getGeofences.mockResolvedValue([{ id: 4, name: 'Warehouse', radius: 500, center: { lat: 13, lng: 77 }, active: true }]);
  getAlerts.mockResolvedValue([{ id: 8, event_type: 'EXIT', title: 'Exited safe zone', tone: 'warning', device: 'Van', fence: 'Warehouse', lat: 13.1, lon: 77, time: '2026-10-23T10:00:00Z' }]);
  render(<MonitoringProvider><Geofence /></MonitoringProvider>);

  expect(await screen.findByRole('heading', { name: 'Telemetry unavailable' })).toBeTruthy();
  expect(await screen.findByRole('heading', { name: 'Warehouse' })).toBeTruthy();
  expect(await screen.findByText('Exited safe zone')).toBeTruthy();
  await waitFor(() => expect(screen.getAllByTestId('map-preview')[0].getAttribute('data-devices')).toBe('0'));
  expect(screen.getAllByTestId('map-preview')[0].getAttribute('data-geofences')).toBe('1');
});
