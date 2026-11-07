/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import Register from './Register';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('axios', () => jest.requireActual('../../../node_modules/axios/dist/browser/axios.cjs'));

const liveTest = process.env.GEOSENTRY_LIVE_TEST === '1' ? test : test.skip;
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

liveTest('React registration creates an account and React login receives a token and navigates', async () => {
  const username = process.env.GEOSENTRY_TEST_USERNAME;
  const password = process.env.GEOSENTRY_TEST_PASSWORD;
  expect(username).toBeTruthy();
  expect(password).toBeTruthy();

    const { unmount } = render(<Register />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: username } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect((await screen.findByRole('status', {}, { timeout: 15000 })).textContent).toContain('Account created successfully');

    unmount();
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: username } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'), { timeout: 15000 });
    expect(localStorage.getItem('token')).toBeTruthy();
}, 30000);
