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

  it('shows the Báo giá menu under Danh mục & Sản phẩm only when product_quotes is visible and opens that tab', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    const { rerender } = render(
      <Sidebar
        activeTab="dashboard"
        setActiveTab={setActiveTab}
        isOpen
        onClose={vi.fn()}
        currentUser={buildUser()}
        visibleTabIds={new Set(['dashboard', 'products', 'product_packages'])}
        onLogout={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Báo giá/i })).not.toBeInTheDocument();

    rerender(
      <Sidebar
        activeTab="dashboard"
        setActiveTab={setActiveTab}
        isOpen
        onClose={vi.fn()}
        currentUser={buildUser()}
        visibleTabIds={new Set(['dashboard', 'products', 'product_quotes', 'product_packages'])}
        onLogout={vi.fn()}
      />
    );

    const quoteButton = screen.getByRole('button', { name: /Báo giá/i });
    expect(screen.getAllByRole('button', { name: /Sản phẩm\/Dịch vụ/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Gói sản phẩm/i })).toHaveLength(1);

    await user.click(quoteButton);
    expect(setActiveTab).toHaveBeenCalledWith('product_quotes');
  });

  it('shows the Hợp đồng đầu kỳ menu only when pass_contract is visible and opens that tab', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    const { rerender } = render(
      <Sidebar
        activeTab="dashboard"
        setActiveTab={setActiveTab}
        isOpen
        onClose={vi.fn()}
        currentUser={buildUser()}
        visibleTabIds={new Set(['dashboard', 'contracts', 'documents'])}
        onLogout={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Hợp đồng đầu kỳ/i })).not.toBeInTheDocument();

    rerender(
      <Sidebar
        activeTab="dashboard"
        setActiveTab={setActiveTab}
        isOpen
        onClose={vi.fn()}
        currentUser={buildUser()}
        visibleTabIds={new Set(['dashboard', 'contracts', 'pass_contract', 'documents'])}
        onLogout={vi.fn()}
      />
    );

    const passContractButton = screen.getByRole('button', { name: /Hợp đồng đầu kỳ/i });

    await user.click(passContractButton);
    expect(setActiveTab).toHaveBeenCalledWith('pass_contract');
  });
});
