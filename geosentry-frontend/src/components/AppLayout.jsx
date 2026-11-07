import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { MonitoringProvider, useMonitoring } from '../context/MonitoringContext';
import { FiCheckCircle } from 'react-icons/fi';

function hasSession() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch { return false; }
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const { toast } = useMonitoring();
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    const verify = () => { if (!hasSession()) navigate('/login', { replace: true }); };
    const timer = setInterval(verify, 30000);
    window.addEventListener('storage', verify);
    return () => { clearInterval(timer); window.removeEventListener('storage', verify); };
  }, [navigate]);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.activeElement;
    const panel = menuRef.current;
    panel?.querySelector('button, a')?.focus();
    const onKey = e => {
      if (e.key === 'Escape') setMenuOpen(false);
      if (e.key === 'Tab') {
        const items = panel.querySelectorAll('a, button');
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [menuOpen]);
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a>{menuOpen && <div className="drawer-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}<Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} panelRef={menuRef} /><div className="workspace" inert={menuOpen ? true : undefined}><Navbar onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} /><main id="main-content" className="main-content" tabIndex="-1"><Outlet /></main><footer className="workspace-footer"><span>GeoSentry · Location intelligence</span><span>Device data refreshes every 5 seconds</span></footer></div>{toast && <div className="toast" role="status"><FiCheckCircle aria-hidden="true" />{toast}</div>}</div>;
}

export default function AppLayout() {
  if (!hasSession()) return <Navigate to="/login" replace />;
  return <MonitoringProvider><Shell /></MonitoringProvider>;
}
