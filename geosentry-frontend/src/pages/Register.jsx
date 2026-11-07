import React, { useState } from 'react';
import { FiUser, FiArrowRight, FiLoader, FiCheckCircle } from 'react-icons/fi';
import API from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { ErrorMessage, PasswordField } from '../components/UI';
import './Login.css';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  async function handleRegister(e) {
    e.preventDefault();
    if (pending) return;
    setError('');
    if (!username.trim()) { setError('Choose a username that is not blank.'); return; }
    if (new Blob([password]).size > 72) { setError('Your password is too long. Use at most 72 bytes (usually 72 characters).'); return; }
    setPending(true);
    try { await API.post('/users/signup', { username, password }); setSuccess(true); }
    catch (err) {
      if (err.response?.status === 409) setError('This username is already taken. Please choose another or sign in.');
      else if (err.response) setError(`Unable to create your account (HTTP ${err.response.status}). Please check your details and try again.`);
      else setError('Unable to connect to GeoSentry. Check that the backend is running and try again.');
    } finally { setPending(false); }
  }
  return <AuthLayout><span className="auth-kicker">WELCOME TO GEOSENTRY</span><h2>{success ? 'You’re ready to sign in' : 'Create your account'}</h2><p className="auth-description">{success ? 'Your monitoring workspace is one step away.' : 'A clearer picture of the places and devices that matter.'}</p>{success ? <><div className="message message-success" role="status"><FiCheckCircle aria-hidden="true" />Account created successfully. Sign in with your new credentials.</div><a className="button button-primary auth-submit" href="/login">Continue to Login <FiArrowRight aria-hidden="true" /></a></> : <form onSubmit={handleRegister} aria-busy={pending}><div className="field"><label htmlFor="username">Username</label><div className="input-wrap"><FiUser aria-hidden="true" /><input id="username" name="username" placeholder="Username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} disabled={pending} /></div><small>You’ll use this name to sign in.</small></div><PasswordField value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" disabled={pending} /><ErrorMessage>{error}</ErrorMessage><button className="button button-primary auth-submit" disabled={pending}>{pending ? <><FiLoader className="spin" aria-hidden="true" /> Creating account…</> : <>Register <FiArrowRight aria-hidden="true" /></>}</button></form>}<p className="auth-switch">Already have an account? <a href="/login">Login</a></p></AuthLayout>;
}
