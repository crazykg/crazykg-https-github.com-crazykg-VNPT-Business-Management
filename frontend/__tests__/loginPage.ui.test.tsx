import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../components/LoginPage';

describe('LoginPage password input hardening', () => {
  it('submits the typed password without rendering it as a controlled value attribute', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <LoginPage
        isLoading={false}
        errorMessage=""
        infoMessage=""
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText('admin hoặc admin@vnpt.vn'), 'ropv.hgi');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    await user.type(passwordInput, 'ropv.hgi');

    expect(passwordInput).toHaveValue('ropv.hgi');
    expect(passwordInput.getAttribute('value')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(onSubmit).toHaveBeenCalledWith({
      username: 'ropv.hgi',
      password: 'ropv.hgi',
    });
  });
});
