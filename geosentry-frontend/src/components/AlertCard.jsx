import React from 'react';
import { FiLogIn, FiLogOut } from 'react-icons/fi';
import { StatusBadge, formatTime } from './UI';

export default function AlertCard({ alert }) {
  const Icon = alert.tone === 'safe' ? FiLogIn : FiLogOut;
  const timestamp = alert.time || alert.timestamp;
  return <article className={`alert-card alert-${alert.tone}`}>
    <span className="alert-icon"><Icon aria-hidden="true" /></span>
    <div className="alert-copy">
      <div className="alert-title">
        <h3>{alert.title}</h3>
        <StatusBadge tone={alert.tone}>{alert.tone === 'safe' ? 'Safe' : 'Warning'}</StatusBadge>
        {alert.pending && <StatusBadge tone="warning">Not saved · retrying</StatusBadge>}
      </div>
      <p>{alert.device} · {alert.fence}</p>
      <small><time dateTime={timestamp}>{new Date(timestamp).toLocaleDateString()} · {formatTime(timestamp)}</time> · {Number(alert.lat).toFixed(5)}, {Number(alert.lon).toFixed(5)}</small>
    </div>
  </article>;
}
