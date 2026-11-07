import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiUser, FiLoader } from 'react-icons/fi';
import API from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { ErrorMessage, PasswordField } from '../components/UI';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const handleLogin = async (e) => {
    e.preventDefault();
    if (pending) return;
    setError('');
    if (!username.trim()) { setError('Enter your username to continue.'); return; }
    setPending(true);
    try {
      const { data } = await API.post('/users/login', { username, password });
      if (typeof data.token !== 'string' || !data.token) {
        setError('Unable to start your session: missing token in the server response. Please try again.');
        return;
      }
      try { localStorage.setItem('token', data.token); }
      catch { setError('Login succeeded, but this browser blocked session storage. Allow site storage and try again.'); return; }
      try { localStorage.setItem('geosentry.username', username); } catch { /* Display name is optional. */ }
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 401) setError("Invalid username or password. Create an account first if you haven't registered.");
      else if (err.response) setError(`Unable to sign in (HTTP ${err.response.status}). Please try again in a moment.`);
      else setError('Unable to connect to GeoSentry. Check that the backend is running and try again.');
    } finally { setPending(false); }
  };
  return <AuthLayout><span className="auth-kicker">YOUR MONITORING WORKSPACE</span><h2>Welcome back</h2><p className="auth-description">Sign in to see your world with greater clarity.</p><form onSubmit={handleLogin} aria-busy={pending}><div className="field"><label htmlFor="username">Username</label><div className="input-wrap"><FiUser aria-hidden="true" /><input id="username" name="username" placeholder="Username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} disabled={pending} /></div></div><PasswordField value={password} onChange={e => setPassword(e.target.value)} disabled={pending} /><ErrorMessage>{error}</ErrorMessage><button className="button button-primary auth-submit" type="submit" disabled={pending}>{pending ? <><FiLoader className="spin" aria-hidden="true" /> Logging in...</> : <>Login <FiArrowRight aria-hidden="true" /></>}</button></form><p className="auth-switch">New to GeoSentry? <a href="/register">Create account</a></p></AuthLayout>;
}
