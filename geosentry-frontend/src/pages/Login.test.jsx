import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import API from '../services/api';

const mockNavigate = jest.fn();
// CRA's Jest resolver predates React Router 7's package exports.
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../services/api', () => ({ post: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });
function submit() {
  render(<Login />);
  fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'tester' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
}
test('authenticates before navigating to dashboard', async () => {
  API.post.mockResolvedValue({ data: { token: 'test-token' } });
  submit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  expect(API.post).toHaveBeenCalledWith('/users/login', { username: 'tester', password: 'password' });
  expect(localStorage.getItem('token')).toBe('test-token');
});
test('invalid credentials do not navigate', async () => {
  API.post.mockRejectedValue({ response: { status: 401 } });
  submit();
  expect((await screen.findByRole('alert')).textContent).toContain('Invalid username or password');
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('server failures show their HTTP status instead of claiming the backend is offline', async () => {
  API.post.mockRejectedValue({ response: { status: 500 } });
  submit();
  expect((await screen.findByRole('alert')).textContent).toContain('HTTP 500');
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('missing tokens do not navigate', async () => {
  API.post.mockResolvedValue({ data: {} });
  submit();
  expect((await screen.findByRole('alert')).textContent).toContain('missing token');
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('blocked browser storage is distinguished from backend failure', async () => {
  API.post.mockResolvedValue({ data: { token: 'test-token' } });
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  try {
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain('browser blocked session storage');
    expect(mockNavigate).not.toHaveBeenCalled();
  } finally {
    storage.mockRestore();
  }
});
test('network errors are handled', async () => {
  API.post.mockRejectedValue(new Error('Network Error'));
  submit();
  expect((await screen.findByRole('alert')).textContent).toContain('backend is running');
  expect(mockNavigate).not.toHaveBeenCalled();
});
