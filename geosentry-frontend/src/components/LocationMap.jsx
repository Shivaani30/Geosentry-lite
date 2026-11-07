import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { FiCrosshair, FiMapPin } from 'react-icons/fi';
import carIconImage from '../assets/car-icon.png';

const deviceIcon = L.divIcon({ className: 'device-marker', html: '<span class="device-marker-core"></span>', iconSize: [28, 28], iconAnchor: [14, 14] });
const vehicleIcon = L.icon({ iconUrl: carIconImage, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -18] });
const centerIcon = L.divIcon({ className: 'center-marker', html: '<span>+</span>', iconSize: [26, 26], iconAnchor: [13, 13] });
const NEUTRAL_MAP_CENTER = [20, 0];

function MapBehavior({ devices, selectedId, geofences, draft, follow, centerRequest, onPick }) {
  const map = useMap();
  const selected = devices.find(d => String(d.id) === String(selectedId)) || devices[0];
  const lat = selected?.lat, lon = selected?.lon;
  const draftLat = draft?.lat, draftLng = draft?.lng, draftRadius = draft?.radius;
  const lastFocus = useRef({ selection: null, hasPosition: false, centerRequest: 0, geofences: null, draft: null });
  useMapEvents({ click(e) { if (onPick) onPick(e.latlng); } });
  useEffect(() => {
    const selection = selected?.id == null ? null : String(selected.id);
    const hasPosition = Number.isFinite(lat) && Number.isFinite(lon);
    const draftKey = draftLat == null || draftLng == null ? null : `${draftLat}:${draftLng}:${draftRadius}`;
    const previous = lastFocus.current;
    const shouldFocus = selection !== previous.selection || (!previous.hasPosition && hasPosition) ||
      centerRequest !== previous.centerRequest || geofences !== previous.geofences || draftKey !== previous.draft;
    lastFocus.current = { selection, hasPosition, centerRequest, geofences, draft: draftKey };
    if (!shouldFocus) return;

    if (centerRequest !== previous.centerRequest && hasPosition) {
      map.setView([lat, lon], 15, { animate: false });
      return;
    }

    const bounds = L.latLngBounds([]);
    geofences.filter(fence => fence.active !== false && Number.isFinite(fence.radius) && fence.radius > 0).forEach(fence => {
      bounds.extend(L.circle([fence.center.lat, fence.center.lng], { radius: fence.radius }).getBounds());
    });
    if (Number.isFinite(draftLat) && Number.isFinite(draftLng)) {
      bounds.extend(L.circle([draftLat, draftLng], { radius: Number.isFinite(draftRadius) && draftRadius > 0 ? draftRadius : 1 }).getBounds());
    }
    if (hasPosition) bounds.extend([lat, lon]);

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: hasPosition ? 15 : 13, animate: false });
    else map.setView(NEUTRAL_MAP_CENTER, 2, { animate: false });
  }, [map, selected?.id, lat, lon, geofences, draftLat, draftLng, draftRadius, centerRequest]);
  useEffect(() => {
    if (follow && lat != null && lon != null) map.setView([lat, lon], map.getZoom() < 10 ? 15 : map.getZoom(), { animate: false });
  }, [map, lat, lon, follow]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function LocationMap({ devices = [], geofences = [], selectedId, featuredDeviceId, onPick, draft, tall = false }) {
  const valid = devices.filter(d => d.hasLocation);
  const selected = valid.find(d => String(d.id) === String(selectedId)) || valid[0];
  const activeGeofences = useMemo(() => geofences.filter(fence => fence.active !== false), [geofences]);
  const initialCenter = selected ? [selected.lat, selected.lon] : activeGeofences.length ? [activeGeofences[0].center.lat, activeGeofences[0].center.lng] : NEUTRAL_MAP_CENTER;
  const initialZoom = selected ? 15 : activeGeofences.length ? 13 : 2;
  const [follow, setFollow] = useState(false);
  const [centerRequest, setCenterRequest] = useState(0);
  const [tileError, setTileError] = useState(false);
  return <div className={`map-frame ${tall ? 'map-tall' : ''}`}><MapContainer center={initialCenter} zoom={initialZoom} zoomControl={false} scrollWheelZoom={false} aria-label="Device location map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }} /><ZoomControl position="bottomright" /><MapBehavior devices={valid} selectedId={selected?.id} geofences={activeGeofences} draft={draft} follow={follow} centerRequest={centerRequest} onPick={onPick} />{valid.map(device => { const featured = featuredDeviceId != null && String(device.id) === String(featuredDeviceId); const positionLabel = device.isDemo ? 'DEMO · simulated position' : featured ? 'Selected vehicle · reported position' : 'Reported device location'; return <Marker key={device.id} position={[device.lat, device.lon]} icon={featured ? vehicleIcon : deviceIcon} title={device.isDemo ? 'Demo vehicle · simulated location' : featured ? `Selected vehicle: ${device.name || `Device ${device.id}`}` : `Device ${device.name || device.id}`} alt={device.isDemo ? 'Simulated demo vehicle location' : featured ? 'Selected vehicle location' : 'Device location'}><Popup><div className="map-popup"><strong>{device.name || `Device ${device.id}`}</strong><span>{positionLabel}</span><code>{device.lat.toFixed(6)}, {device.lon.toFixed(6)}</code></div></Popup></Marker>; })}{activeGeofences.map(fence => <Circle key={fence.id} center={[fence.center.lat, fence.center.lng]} radius={fence.radius} pathOptions={{ color: '#247862', fillColor: '#3f9e7c', fillOpacity: 0.12, weight: 2 }}><Popup><strong>{fence.name}</strong><br />Radius: {fence.radius} m</Popup></Circle>)}{draft && <><Marker position={[draft.lat, draft.lng]} icon={centerIcon} />{draft.radius > 0 && <Circle center={[draft.lat, draft.lng]} radius={draft.radius} pathOptions={{ color: '#376e9f', dashArray: '6 6', fillOpacity: 0.08 }} />}</>}</MapContainer><div className="map-tools"><span className="map-label"><FiMapPin aria-hidden="true" />{onPick ? 'Click the map to choose a center' : 'Location overview'}</span>{valid.length > 0 && <div className="map-controls"><button className="map-control" onClick={() => setCenterRequest(n => n + 1)} title="Center on selected device" aria-label="Center on selected device"><FiCrosshair /></button><button className={`map-control ${follow ? 'selected' : ''}`} onClick={() => setFollow(!follow)} aria-pressed={follow}>Follow {follow ? 'on' : 'off'}</button></div>}</div>{tileError && <div className="map-notice" role="status">Map tiles are unavailable. Check your internet connection; device coordinates remain available.</div>}<div className="map-legend">{featuredDeviceId != null && valid.some(d => String(d.id) === String(featuredDeviceId)) && <span><img className="legend-vehicle" src={carIconImage} alt="" />{valid.find(d => String(d.id) === String(featuredDeviceId))?.isDemo ? 'Demo vehicle · simulated' : 'Selected vehicle'}</span>}<span><i className="legend-device" />Device location</span><span><i className="legend-zone" />Safe zone</span></div></div>;
}
