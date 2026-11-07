import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiBell, FiChevronRight } from 'react-icons/fi';
import { StatusBadge } from './UI';
import { useMonitoring } from '../context/MonitoringContext';

const titles = { '/dashboard': 'Overview', '/tracking': 'Live map', '/alerts': 'Alerts', '/geofence': 'Safe zones', '/devices': 'Devices' };
export default function Navbar({ onMenu, menuOpen }) {
  const { pathname } = useLocation();
  const { loading, error, alerts } = useMonitoring();
  let username = 'Account';
  try { username = localStorage.getItem('geosentry.username') || username; } catch { /* Optional display name. */ }
  return <header className="topbar"><div className="breadcrumb"><button className="icon-button menu-toggle" onClick={onMenu} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="workspace-navigation"><FiMenu /></button><span className="breadcrumb-root">Workspace</span><FiChevronRight className="breadcrumb-root" aria-hidden="true" /><strong>{titles[pathname] || 'Workspace'}</strong></div><div className="topbar-actions"><div className="connection-status" role="status" aria-live="polite"><StatusBadge tone={loading ? 'info' : error ? 'warning' : 'safe'}>{loading ? 'Connecting' : error ? 'Connection interrupted' : 'API connected'}</StatusBadge></div><Link to="/alerts" className="icon-button notification-button" aria-label={`Alerts, ${alerts.length} session events`}><FiBell aria-hidden="true" />{alerts.length > 0 && <span className="notification-dot" />}</Link><div className="profile" title={username}><span className="avatar" aria-hidden="true">{username.slice(0, 2).toUpperCase()}</span><span className="profile-name">{username}<small>My workspace</small></span></div></div></header>;
}
