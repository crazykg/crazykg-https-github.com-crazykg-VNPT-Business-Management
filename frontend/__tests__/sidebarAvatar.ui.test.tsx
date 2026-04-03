import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../components/Sidebar';
import { useAuthStore } from '../shared/stores';
import type { AuthUser } from '../types';
import { updateCurrentUserAvatar } from '../services/api/legacy';

vi.mock('../services/api/legacy', () => ({
  updateCurrentUserAvatar: vi.fn(),
}));

const buildUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  username: 'ropv.hgi',
  full_name: 'Phan Văn Rở',
  email: 'ropv.hgi@vnpt.vn',
  status: 'ACTIVE',
  roles: [],
  permissions: [],
  dept_scopes: [],
  ...overrides,
});

describe('Sidebar avatar handling', () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthLoading: false,
      isLoginLoading: false,
      passwordChangeRequired: false,
    });
    vi.clearAllMocks();
  });

  it('renders a stable initials fallback when the user has no custom avatar', () => {
    render(
      <Sidebar
        activeTab="dashboard"
        setActiveTab={vi.fn()}
        isOpen
        onClose={vi.fn()}
        currentUser={buildUser()}
        visibleTabIds={new Set(['dashboard'])}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('PR')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Avatar Phan Văn Rở/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Đổi ảnh')).not.toBeInTheDocument();
  });

  it('uploads a new avatar and updates the preview instead of using a random image', async () => {
    const user = userEvent.setup();
    const avatarDataUrl = 'data:image/png;base64,ZmFrZS1hdmF0YXI=';

    vi.mocked(updateCurrentUserAvatar).mockResolvedValue(
      buildUser({
        avatar_data_url: avatarDataUrl,
        avatar_updated_at: '2026-04-03 13:45:00',
      })
    );

    render(
      <Sidebar
        activeTab="dashboard"
        setActiveTab={vi.fn()}
        isOpen
        onClose={vi.fn()}
        currentUser={buildUser()}
        visibleTabIds={new Set(['dashboard'])}
        onLogout={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Chọn ảnh đại diện') as HTMLInputElement;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    await user.upload(input, file);

    await waitFor(() => {
      expect(updateCurrentUserAvatar).toHaveBeenCalledWith(file);
    });

    expect(await screen.findByRole('img', { name: /Ảnh đại diện Phan Văn Rở/i })).toHaveAttribute('src', avatarDataUrl);
    expect(screen.queryByText('Đổi ảnh')).not.toBeInTheDocument();
    expect(screen.queryByText('Đã cập nhật ảnh đại diện.')).not.toBeInTheDocument();
  });
});
