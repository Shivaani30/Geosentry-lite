import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Register from './Register';
import API from '../services/api';

jest.mock('../services/api', () => ({ post: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
function submit(password = 'safe-test-password') {
  render(<Register />);
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'test-user' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
}
test('registration sends only supported fields and offers login after success', async () => {
  API.post.mockResolvedValue({ data: { message: 'Account created' } });
  submit();
  expect((await screen.findByRole('status')).textContent).toContain('Account created successfully');
  expect(API.post).toHaveBeenCalledWith('/users/signup', { username: 'test-user', password: 'safe-test-password' });
  expect(screen.getByRole('link', { name: /Continue to Login/ }).getAttribute('href')).toBe('/login');
});
test('duplicate usernames keep the entered fields and show a helpful error', async () => {
  API.post.mockRejectedValue({ response: { status: 409 } });
  submit();
  expect((await screen.findByRole('alert')).textContent).toContain('already taken');
  expect(screen.getByLabelText('Username').value).toBe('test-user');
});
test('pending registration disables submission and prevents repeated requests', () => {
  API.post.mockReturnValue(new Promise(() => {}));
  submit();
  expect(screen.getByRole('button', { name: /Creating account/ }).disabled).toBe(true);
  expect(API.post).toHaveBeenCalledTimes(1);
});
test('password visibility is accessible and preserves its value', () => {
  render(<Register />);
  const password = screen.getByLabelText('Password');
  fireEvent.change(password, { target: { value: 'example' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password.type).toBe('text');
  expect(password.value).toBe('example');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(password.type).toBe('password');
});
test('rejects passwords beyond the backend byte limit before making a request', async () => {
  submit('a'.repeat(73));
  expect((await screen.findByRole('alert')).textContent).toContain('too long');
  expect(API.post).not.toHaveBeenCalled();
});
