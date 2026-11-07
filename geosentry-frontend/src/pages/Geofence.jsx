import React, { useState } from 'react';
import { FiClock, FiEdit2, FiMapPin, FiPlus, FiShield, FiTrash2, FiTruck } from 'react-icons/fi';
import { useMonitoring } from '../context/MonitoringContext';
import AlertCard from '../components/AlertCard';
import { EmptyState, ErrorMessage, LoadingState, PageHeading, StatusBadge, formatTime } from '../components/UI';
import LocationMap from '../components/LocationMap';
import { isInsideGeofence } from '../services/geofence';
import useDemoRoute from '../hooks/useDemoRoute';

export default function Geofence() {
  const {
    devices, geofences, geofenceLoading, geofenceError, refreshGeofences,
    addFence, updateFence, deleteFence, savingGeofence, deletingGeofenceId,
    error: connectionError, refresh, lastFetched, loading,
    alerts, alertsLoading, alertsError, refreshAlerts,
  } = useMonitoring();
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('200');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [editingFenceId, setEditingFenceId] = useState(null);
  const [formError, setFormError] = useState('');
  const demo = useDemoRoute(geofences);

  const locatedDevices = devices.filter(device => device.hasLocation);
  const selectedDevice = locatedDevices.find(device => String(device.id) === String(selectedDeviceId)) || locatedDevices[0] || devices.find(device => String(device.id) === String(selectedDeviceId)) || devices[0];
  const located = Boolean(selectedDevice?.hasLocation);
  const telemetryUnavailable = Boolean(selectedDevice?.telemetry_configured && !selectedDevice.telemetry_available);
  const activeGeofences = geofences.filter(fence => fence.active !== false);
  const fenceStates = located ? activeGeofences.map(fence => ({ fence, inside: isInsideGeofence(selectedDevice.lat, selectedDevice.lon, fence.center, fence.radius / 1000) })) : [];
  const insideCount = fenceStates.filter(item => item.inside).length;
  const mapDevices = demo.demoDevice ? [...devices, demo.demoDevice] : devices;
  const mapVehicle = demo.demoDevice || selectedDevice;
  const validCenter = latitude !== '' && longitude !== '' && Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90 && Number.isFinite(Number(longitude)) && Math.abs(Number(longitude)) <= 180;
  const draft = validCenter && Number.isFinite(Number(radius)) && Number(radius) > 0
    ? { lat: Number(latitude), lng: Number(longitude), radius: Number(radius) }
    : null;

  function resetForm() {
    setName(''); setLatitude(''); setLongitude(''); setRadius('200'); setIsActive(true); setEditingFenceId(null); setFormError('');
  }

  function editFence(fence) {
    setEditingFenceId(fence.id);
    setName(fence.name);
    setLatitude(String(fence.center.lat));
    setLongitude(String(fence.center.lng));
    setRadius(String(fence.radius));
    setIsActive(fence.active !== false);
    setFormError('');
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!name.trim()) { setFormError('Give your geofence a name.'); return; }
    if (!validCenter || !Number.isFinite(Number(radius)) || Number(radius) <= 0 || Number(radius) > 100000) {
      setFormError('Choose valid coordinates and a radius from 1 to 100,000 meters.');
      return;
    }
    const fence = {
      name: name.trim(),
      radius: Number(radius),
      center: { lat: Number(latitude), lng: Number(longitude) },
      is_active: isActive,
      device_id: editingFenceId == null ? null : geofences.find(item => String(item.id) === String(editingFenceId))?.device_id ?? null,
    };
    try {
      if (editingFenceId == null) await addFence(fence);
      else await updateFence(editingFenceId, fence);
      resetForm();
    } catch { /* The context retains the current list and exposes the API error. */ }
  }

  async function handleDelete(fence) {
    if (!window.confirm(`Delete “${fence.name}”? Its saved alert history will remain.`)) return;
    try {
      await deleteFence(fence.id);
      if (String(editingFenceId) === String(fence.id)) resetForm();
    } catch { /* The context retains the fence and exposes the API error. */ }
  }

  return <>
    <PageHeading eyebrow="GEOFENCE MANAGEMENT" title="Define your safe spaces" description="Monitor reported vehicle locations against your safe-zone boundaries.">
      <StatusBadge tone="info">Saved to your account</StatusBadge>
    </PageHeading>
    <div className="message message-info"><FiShield aria-hidden="true" /><div>Geofences and boundary alerts are saved to your account and remain available after refresh.</div></div>
    <ErrorMessage onRetry={refresh}>{connectionError}</ErrorMessage>

    <div className="geofence-live-layout">
      <section className="panel map-panel geofence-live-map-panel" aria-labelledby="live-map-heading">
        <div className="panel-heading"><div><h2 id="live-map-heading">Geofence map</h2><p>Live device positions and active boundaries; demo locations are labeled separately</p></div><StatusBadge tone={demo.demoDevice || demo.running ? 'warning' : connectionError || telemetryUnavailable ? 'warning' : 'info'}>{demo.running ? 'DEMO ROUTE RUNNING' : demo.demoDevice ? 'DEMO PAUSED' : connectionError ? 'Updates interrupted' : telemetryUnavailable || !selectedDevice ? 'Telemetry unavailable' : 'Polls every 5 sec'}</StatusBadge></div>
        {loading && !lastFetched ? <div className="geofence-map-loading" role="status">Loading reported locations…</div> : <LocationMap devices={mapDevices} geofences={geofences} selectedId={mapVehicle?.id} featuredDeviceId={mapVehicle?.id} tall />}
      </section>

      <aside className="panel geofence-vehicle-panel" aria-labelledby="vehicle-status-heading">
        <div className="panel-heading"><div><h2 id="vehicle-status-heading">Vehicle status</h2><p>Latest coordinates returned by GeoSentry</p></div><FiTruck aria-hidden="true" /></div>
        <div className="panel-body">
          {devices.length > 0 && <div className="field"><label htmlFor="geofence-selected-device">Vehicle / device</label><select id="geofence-selected-device" value={selectedDevice?.id ?? ''} onChange={event => setSelectedDeviceId(event.target.value)}>{devices.map(device => <option value={device.id} key={device.id}>{device.name || `Device ${device.id}`}</option>)}</select></div>}
          {demo.demoDevice && <div className="demo-vehicle-status" role="status"><div className="demo-vehicle-heading"><strong>Simulated demo vehicle</strong><StatusBadge tone="warning">DEMO · NOT LIVE GPS</StatusBadge></div><dl className="detail-list geofence-detail-list"><div><dt>Latitude</dt><dd>{demo.demoDevice.lat.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>{demo.demoDevice.lon.toFixed(6)}</dd></div><div><dt>Geofence</dt><dd>{demo.inside ? `Inside ${demo.selectedFence?.name}` : `Outside ${demo.selectedFence?.name}`}</dd></div></dl></div>}
          {selectedDevice ? <>
            <div className="vehicle-status-line"><span className="device-symbol"><FiTruck aria-hidden="true" /></span><div className="vehicle-name"><strong>{selectedDevice.name || `Device ${selectedDevice.id}`}</strong><small>Device ID {selectedDevice.id}</small></div><StatusBadge tone={located ? 'safe' : 'warning'}>{located ? selectedDevice.telemetry_configured ? 'Live telemetry' : 'Coordinates available' : selectedDevice.telemetry_configured ? 'Telemetry unavailable' : 'No location'}</StatusBadge></div>
            <dl className="detail-list geofence-detail-list">
              <div><dt>Latitude</dt><dd>{located ? selectedDevice.lat.toFixed(6) : 'Unavailable'}</dd></div>
              <div><dt>Longitude</dt><dd>{located ? selectedDevice.lon.toFixed(6) : 'Unavailable'}</dd></div>
              <div><dt>Data fetched</dt><dd><FiClock aria-hidden="true" /> {formatTime(lastFetched)}</dd></div>
              {selectedDevice.timestamp != null && <div><dt>GPS update</dt><dd>{formatTime(selectedDevice.timestamp)}</dd></div>}
              {selectedDevice.speed != null && <div><dt>Speed</dt><dd>{selectedDevice.speed} km/h</dd></div>}
            </dl>
            <p className="info-note">GPS time and speed appear only when supplied by the telemetry service. Fetch time shows when GeoSentry last checked for a position.</p>
            <div className="geofence-status-block">
              <h3><FiShield aria-hidden="true" /> Geofence status</h3>
              {!located ? <p className="geofence-status-empty">Waiting for valid device coordinates.</p> : !activeGeofences.length ? <p className="geofence-status-empty">No active geofences are defined.</p> : <>
                <StatusBadge tone={insideCount > 0 ? 'safe' : 'critical'}>{insideCount > 0 ? `Inside ${insideCount} geofence${insideCount === 1 ? '' : 's'}` : 'Outside all geofences · Alert'}</StatusBadge>
                <ul className="geofence-status-list">{fenceStates.map(({ fence, inside }) => <li key={fence.id}><span>{fence.name}</span><StatusBadge tone={inside ? 'safe' : 'critical'}>{inside ? 'Inside · Safe' : 'Outside · Alert'}</StatusBadge></li>)}</ul>
              </>}
            </div>
          </> : <EmptyState icon={FiTruck} title={connectionError ? 'Device data unavailable' : 'Telemetry unavailable'}>{connectionError ? 'Reconnect to the server to retrieve stored device coordinates.' : 'No live vehicle position is available. Saved geofences remain active and manageable.'}</EmptyState>}
        </div>
      </aside>
    </div>

    <section className="panel demo-route-panel" aria-labelledby="demo-route-heading">
      <div className="panel-heading"><div><h2 id="demo-route-heading">Demo route playback</h2><p>Exercise geofence crossings with a deterministic simulated route.</p></div><StatusBadge tone="warning">SIMULATED · NOT LIVE GPS</StatusBadge></div>
      <div className="panel-body">
        {demo.activeGeofences.length ? <>
          <div className="demo-route-controls">
            <div className="field"><label htmlFor="demo-route-fence">Geofence to cross</label><select id="demo-route-fence" value={demo.selectedFenceId} onChange={event => demo.chooseFence(event.target.value)} disabled={demo.running}>{demo.activeGeofences.map(fence => <option value={fence.id} key={fence.id}>{fence.name}</option>)}</select></div>
            <div className="demo-route-buttons">
              {demo.running ? <button type="button" className="button button-primary" onClick={demo.pauseDemo}>Pause demo</button> : <button type="button" className="button button-primary" onClick={demo.startDemo}>{demo.demoDevice ? 'Resume demo' : 'Start demo route'}</button>}
              <button type="button" className="button button-secondary" onClick={demo.resetDemo} disabled={!demo.demoDevice && !demo.events.length}>Reset demo</button>
            </div>
          </div>
          {demo.demoDevice ? <div className="demo-route-status" role="status" aria-live="polite"><StatusBadge tone={demo.inside ? 'safe' : 'warning'}>{demo.inside ? 'Inside geofence' : 'Outside geofence'}</StatusBadge><span>{demo.running ? `Step ${demo.stepIndex + 1} of ${demo.stepCount} · advancing every 1.8 seconds` : 'Paused · demo marker remains on the map'}</span></div> : <p className="field-help demo-route-help">The route starts outside the selected boundary, then crosses inside and outside. Demo positions and events stay in this page session and are never saved as real telemetry or alerts.</p>}
          <div className="demo-events" aria-live="polite"><h3>Demo route events <span className="count-label">{demo.events.length}</span></h3>{demo.events.length ? <ol>{demo.events.map(event => <li className={`demo-event demo-event-${event.type.toLowerCase()}`} key={event.id}><StatusBadge tone={event.type === 'ENTER' ? 'safe' : 'warning'}>{event.type} · DEMO</StatusBadge><div><strong>Simulated vehicle {event.type === 'ENTER' ? 'entered' : 'exited'} {event.fence}</strong><time dateTime={event.time}>{formatTime(event.time)}</time></div></li>)}</ol> : <p>Start playback to see an ENTER and EXIT transition. These demo events are not part of saved alert history.</p>}</div>
        </> : <EmptyState icon={FiShield} title="Add an active geofence to play a route">Demo playback uses one of your saved active boundaries. It does not create or alter geofences.</EmptyState>}
      </div>
    </section>

    <div className="geofence-grid">
      <section className="panel">
        <div className="panel-heading"><h2>{editingFenceId == null ? 'Create a geofence' : 'Edit geofence'}</h2><FiPlus aria-hidden="true" /></div>
        <form className="panel-body fence-form" onSubmit={handleSave}>
          <div className="field"><label htmlFor="zone-name">Geofence name</label><input id="zone-name" placeholder="e.g. Main office" required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></div>
          <div className="field"><label htmlFor="radius">Radius (meters)</label><input id="radius" type="number" min="1" max="100000" step="any" required value={radius} onChange={event => setRadius(event.target.value)} /></div>
          <p className="field-help"><FiMapPin aria-hidden="true" />Click the map or enter a center below.</p>
          <div className="coordinate-fields">
            <div className="field"><label htmlFor="latitude">Latitude</label><input id="latitude" type="number" min="-90" max="90" step="any" placeholder="−90 to 90" required value={latitude} onChange={event => setLatitude(event.target.value)} /></div>
            <div className="field"><label htmlFor="longitude">Longitude</label><input id="longitude" type="number" min="-180" max="180" step="any" placeholder="−180 to 180" required value={longitude} onChange={event => setLongitude(event.target.value)} /></div>
          </div>
          <label className="field-check"><input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} /> Active geofence</label>
          <ErrorMessage>{formError || geofenceError}</ErrorMessage>
          <button className="button button-primary full-width" disabled={savingGeofence}>{savingGeofence ? 'Saving…' : editingFenceId == null ? 'Save geofence' : 'Update geofence'}</button>
          {editingFenceId != null && <button type="button" className="button button-secondary full-width" onClick={resetForm} disabled={savingGeofence}>Cancel edit</button>}
        </form>
      </section>
      <section className="panel map-panel">
        <div className="panel-heading"><div><h2>Boundary preview</h2><p>Your selected center and radius appear in blue</p></div></div>
        <LocationMap devices={devices} geofences={geofences} onPick={point => { setLatitude(point.lat.toFixed(6)); setLongitude(point.lng.toFixed(6)); }} draft={draft} />
      </section>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><h2>Saved geofences <span className="count-label">{geofences.length}</span></h2><p>Inactive fences are saved but excluded from boundary monitoring.</p></div></div>
      <ErrorMessage onRetry={refreshGeofences}>{geofenceError}</ErrorMessage>
      {geofenceLoading ? <LoadingState label="Loading geofences…" /> : geofences.length ? <div className="zone-grid">{geofences.map(zone => <article className={`zone-card ${zone.active === false ? 'zone-inactive' : ''}`} key={zone.id}>
        <span className="device-symbol"><FiShield aria-hidden="true" /></span><StatusBadge tone={zone.active === false ? 'info' : 'safe'}>{zone.active === false ? 'Inactive' : 'Active'}</StatusBadge>
        <h3>{zone.name}</h3><p>{zone.radius.toLocaleString()} m radius</p><code>{zone.center.lat.toFixed(5)}, {zone.center.lng.toFixed(5)}</code>
        <div className="zone-actions"><button type="button" className="button button-secondary" onClick={() => editFence(zone)}><FiEdit2 aria-hidden="true" />Edit</button><button type="button" className="button button-secondary" disabled={String(deletingGeofenceId) === String(zone.id)} onClick={() => handleDelete(zone)}><FiTrash2 aria-hidden="true" />{String(deletingGeofenceId) === String(zone.id) ? 'Deleting…' : 'Delete'}</button></div>
      </article>)}</div> : <EmptyState icon={FiShield} title="No geofences saved">Choose a center and radius above. Your geofence will remain saved after refresh.</EmptyState>}
    </section>

    <section className="panel">
      <div className="panel-heading"><div><h2>Boundary alert history <span className="count-label">{alerts.length}</span></h2><p>Most recent saved transitions first</p></div></div>
      <ErrorMessage onRetry={refreshAlerts}>{alertsError}</ErrorMessage>
      {alertsLoading ? <LoadingState label="Loading alert history…" /> : alerts.length ? <div className="panel-body">{alerts.slice(0, 5).map(alert => <AlertCard key={alert.id} alert={alert} />)}</div> : <EmptyState icon={FiShield} title="No boundary events yet">Saved ENTER and EXIT events will appear here when real device positions cross an active geofence.</EmptyState>}
    </section>
  </>;
}
