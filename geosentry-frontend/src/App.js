import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login'; // Make sure Login.jsx exists
import MapDashboard from './pages/Mapdashboard';
import Devices from './pages/Devices';
import Geofence from './pages/Geofence';
import Tracking from './pages/Tracking';
import Alerts from './pages/Alerts';
import AppLayout from './components/AppLayout';

function App() {
  return (
    <Routes>
      {/* Root route now points to Login page */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<AppLayout />}>
      <Route path="/dashboard" element={<MapDashboard />} />
      <Route path="/devices" element={<Devices />} />
      <Route path="/geofence" element={<Geofence />} />
      <Route path="/tracking" element={<Tracking />} />
      <Route path="/alerts" element={<Alerts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
