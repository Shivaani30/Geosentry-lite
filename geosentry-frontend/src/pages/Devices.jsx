import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCpu, FiSearch, FiArrowUpRight, FiRefreshCw, FiRadio } from 'react-icons/fi';
import { useMonitoring } from '../context/MonitoringContext';
import { PageHeading, StatusBadge, EmptyState, ErrorMessage, LoadingState, formatTime } from '../components/UI';
import API from '../services/api';

export default function Devices() {
  const { devices, loading, error, refresh, refreshing, lastFetched } = useMonitoring();
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [deviceIds, setDeviceIds] = useState({});
  const [deviceSaving, setDeviceSaving] = useState(null);
  async function registerTelemetryDevice(event) {
    event.preventDefault();
    setSaving(true); setFormError(''); setFormMessage('');
    try {
      await API.post('/devices/register-telemetry', { name, external_id: externalId });
      setName(''); setExternalId('');
      setFormMessage('Device connected. Its live location will refresh automatically.');
      await refresh();
    } catch (err) {
      setFormError(err.response?.data?.detail || (err.response ? `Unable to connect device (HTTP ${err.response.status}).` : 'Unable to connect to GeoSentry. Check the server and try again.'));
    } finally { setSaving(false); }
  }
  async function configureDevice(device, event) {
    event.preventDefault();
    setDeviceSaving(device.id); setFormError(''); setFormMessage('');
    try {
      await API.put(`/devices/${device.id}/telemetry`, { external_id: deviceIds[device.id] || '' });
      setDeviceIds(old => ({ ...old, [device.id]: '' }));
      setFormMessage(`Live telemetry connected for ${device.name || `Device ${device.id}`}.`);
      await refresh();
    } catch (err) {
      setFormError(err.response?.data?.detail || (err.response ? `Unable to connect device (HTTP ${err.response.status}).` : 'Unable to connect to GeoSentry. Check the server and try again.'));
    } finally { setDeviceSaving(null); }
  }
  const filtered = devices.filter(d => `${d.name} ${d.id}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading eyebrow="DEVICE DIRECTORY" title="Connected to your world" description="Browse registered devices and their reported coordinates."><button className="button button-secondary" disabled={refreshing} onClick={refresh}><FiRefreshCw className={refreshing ? 'spin' : ''} aria-hidden="true" />Refresh data</button></PageHeading><ErrorMessage onRetry={refresh}>{error}</ErrorMessage><section className="panel telemetry-connect"><div><span className="eyebrow"><FiRadio aria-hidden="true" /> LIVE TELEMETRY</span><h2>Connect a tracking device</h2><p>GeoSentry checks the telemetry service securely and saves the device only after it receives valid coordinates.</p></div><form onSubmit={registerTelemetryDevice} className="telemetry-connect-form"><label>Device name<input required maxLength="120" value={name} onChange={e => setName(e.target.value)} placeholder="For example, Delivery vehicle" /></label><label>Telemetry device identifier<input required maxLength="200" autoComplete="off" value={externalId} onChange={e => setExternalId(e.target.value)} placeholder="Enter the identifier supplied by your provider" /></label><button className="button button-primary" disabled={saving}>{saving ? 'Checking telemetry…' : 'Connect device'}</button>{formError && <p className="form-message error-text" role="alert">{formError}</p>}{formMessage && <p className="form-message success-text" role="status">{formMessage}</p>}</form></section><section className="panel"><div className="panel-heading"><div><h2>Registered devices {lastFetched && <span className="count-label">{devices.length}</span>}</h2><p>{lastFetched ? `${error ? 'Last successful fetch' : 'Data fetched'} at ${formatTime(lastFetched)}` : 'Waiting for the server'}</p></div><div className="input-wrap search-field"><FiSearch aria-hidden="true" /><input aria-label="Search devices" placeholder="Search by name or ID" value={query} onChange={e => setQuery(e.target.value)} /></div></div>{loading ? <LoadingState label="Loading devices…" /> : filtered.length ? <div className="device-grid">{filtered.map(device => <article className="device-card" key={device.id}><div className="device-card-heading"><span className="device-symbol"><FiCpu aria-hidden="true" /></span><StatusBadge tone={!device.telemetry_configured ? 'info' : device.telemetry_available ? 'safe' : 'warning'}>{device.telemetry_configured ? device.telemetry_available ? 'Live telemetry' : 'Telemetry unavailable' : device.hasLocation ? 'Location available' : 'No coordinates'}</StatusBadge></div><h3>{device.name || `Device ${device.id}`}</h3><p className="device-id">DEVICE ID · {device.id}</p><dl className="detail-grid"><div><dt>Latitude</dt><dd>{device.hasLocation ? device.lat.toFixed(6) : 'Unavailable'}</dd></div><div><dt>Longitude</dt><dd>{device.hasLocation ? device.lon.toFixed(6) : 'Unavailable'}</dd></div><div><dt>Speed</dt><dd>{device.speed == null ? 'Not reported' : `${device.speed} km/h`}</dd></div><div><dt>GPS update time</dt><dd>{formatTime(device.timestamp)}</dd></div></dl>{!device.telemetry_configured && <details className="device-telemetry-config"><summary>Connect live telemetry</summary><form onSubmit={event => configureDevice(device, event)}><label htmlFor={`telemetry-${device.id}`}>Provider device identifier</label><input id={`telemetry-${device.id}`} autoComplete="off" required maxLength="200" value={deviceIds[device.id] || ''} onChange={e => setDeviceIds(old => ({ ...old, [device.id]: e.target.value }))} /><button className="button button-secondary" disabled={deviceSaving === device.id}>{deviceSaving === device.id ? 'Checking…' : 'Verify and connect'}</button></form></details>}<Link className="text-link" to={`/tracking?device=${device.id}`}>View on live map <FiArrowUpRight aria-hidden="true" /></Link></article>)}</div> : <EmptyState icon={FiCpu} title={query ? 'No matching devices' : error ? 'Could not load devices' : 'No devices registered'}>{query ? 'Try a different device name or ID.' : error ? 'Check your connection and try again.' : 'Connect a telemetry device above to display its verified live location.'}</EmptyState>}</section><p className="data-note">External telemetry identifiers are stored by FastAPI and are not returned to the browser. Live locations refresh every five seconds.</p></>;
}
