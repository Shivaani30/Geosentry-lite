/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
// Use Axios's real browser implementation with CRA's older Jest resolver.
jest.mock('axios', () => jest.requireActual('../../../node_modules/axios/dist/browser/axios.cjs'));

const liveTest = process.env.GEOSENTRY_LIVE_TEST === '1' ? test : test.skip;
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });
function submit(username, password) {
  render(<Login />);
  fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
}
liveTest('submitting shivaani sends a real JSON POST and handles rejected credentials', async () => {
  const open = jest.spyOn(XMLHttpRequest.prototype, 'open');
  const send = jest.spyOn(XMLHttpRequest.prototype, 'send');
  try {
    submit('shivaani', 'deliberately-incorrect-test-password');
    expect((await screen.findByRole('alert', {}, { timeout: 15000 })).textContent).toContain('Invalid username or password');
    expect(open).toHaveBeenCalledWith('POST', 'http://127.0.0.1:8000/users/login', true);
    expect(send).toHaveBeenCalledWith(JSON.stringify({ username: 'shivaani', password: 'deliberately-incorrect-test-password' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  } finally { open.mockRestore(); send.mockRestore(); }
}, 20000);
liveTest('a registered account authenticates against FastAPI and navigates to dashboard', async () => {
  expect(process.env.GEOSENTRY_TEST_USERNAME).toBeTruthy();
  expect(process.env.GEOSENTRY_TEST_PASSWORD).toBeTruthy();
  submit(process.env.GEOSENTRY_TEST_USERNAME, process.env.GEOSENTRY_TEST_PASSWORD);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'), { timeout: 15000 });
  expect(localStorage.getItem('token')).toBeTruthy();
}, 20000);
