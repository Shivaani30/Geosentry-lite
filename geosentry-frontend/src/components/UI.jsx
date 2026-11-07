import React from 'react';
import { FiShield, FiMapPin, FiAlertCircle, FiLoader, FiEye, FiEyeOff, FiLock } from 'react-icons/fi';

export function Brand() {
  return <div className="brand"><span className="brand-mark"><FiShield aria-hidden="true" /></span><span>GeoSentry<span className="brand-caption">LOCATION INTELLIGENCE</span></span></div>;
}
export function StatusBadge({ tone = 'info', children }) {
  return <span className={`badge badge-${tone}`}><span className="status-dot" />{children}</span>;
}
export function EmptyState({ title, children, icon: Icon = FiMapPin }) {
  return <div className="empty-state"><span className="empty-icon"><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{children}</p></div>;
}
export function LoadingState({ label = 'Loading your workspace…' }) {
  return <div className="loading-state" role="status"><FiLoader className="spin" aria-hidden="true" /><span>{label}</span></div>;
}
export function ErrorMessage({ children, onRetry }) {
  if (!children) return null;
  return <div className="message message-error" role="alert"><FiAlertCircle aria-hidden="true" /><div>{children}</div>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>;
}
export function StatCard({ icon: Icon, label, value, detail, tone = 'green' }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon aria-hidden="true" /></span></div><strong className="stat-value">{value}</strong><p>{detail}</p></article>;
}
export function PageHeading({ eyebrow = 'WORKSPACE', title, description, children }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}
export function PasswordField({ value, onChange, autoComplete = 'current-password', disabled }) {
  const [visible, setVisible] = React.useState(false);
  return <div className="field"><label htmlFor="password">Password</label><div className="input-wrap"><FiLock aria-hidden="true" /><input id="password" name="password" type={visible ? 'text' : 'password'} placeholder="Password" autoComplete={autoComplete} required value={value} onChange={onChange} disabled={disabled} /><button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}</button></div></div>;
}
export function formatTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
