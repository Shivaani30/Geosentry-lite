import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiGrid, FiMap, FiBell, FiShield, FiCpu, FiLogOut, FiX, FiArrowUpRight } from 'react-icons/fi';
import { Brand } from './UI';
import { useMonitoring } from '../context/MonitoringContext';

export default function Sidebar({ open, onClose, panelRef }) {
  const navigate = useNavigate();
  const { alerts } = useMonitoring();
  const items = [{ label: 'Overview', path: '/dashboard', icon: FiGrid }, { label: 'Live map', path: '/tracking', icon: FiMap }, { label: 'Alerts', path: '/alerts', icon: FiBell }, { label: 'Safe zones', path: '/geofence', icon: FiShield }, { label: 'Devices', path: '/devices', icon: FiCpu }];
  function logout() { localStorage.removeItem('token'); localStorage.removeItem('geosentry.username'); navigate('/login', { replace: true }); }
  return <aside id="workspace-navigation" ref={panelRef} className={`sidebar ${open ? 'sidebar-open' : ''}`} role={open ? 'dialog' : undefined} aria-modal={open ? 'true' : undefined} aria-label="Workspace navigation"><div className="sidebar-brand"><Brand /><button className="icon-button drawer-close" onClick={onClose} aria-label="Close navigation"><FiX /></button></div><p className="nav-label">WORKSPACE</p><nav aria-label="Main navigation">{items.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon aria-hidden="true" /><span>{label}</span>{path === '/alerts' && alerts.length > 0 && <span className="nav-count">{alerts.length}</span>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="sidebar-note"><FiShield aria-hidden="true" /><h3>Awareness starts here</h3><p>Define a safe zone to follow device movements across its boundary.</p><NavLink to="/geofence">Manage safe zones <FiArrowUpRight aria-hidden="true" /></NavLink></div><button className="logout-button" onClick={logout}><FiLogOut aria-hidden="true" />Logout</button><span className="sidebar-version">GEOSENTRY / MONITORING</span></div></aside>;
}
