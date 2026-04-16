import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestQuickAccessBar } from '../components/customer-request/CustomerRequestQuickAccessBar';
import type { CustomerRequestSavedView } from '../components/customer-request/customerRequestQuickAccess';

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

const savedViews: CustomerRequestSavedView[] = [
  {
    id: 'overview',
    label: 'Toàn cảnh',
    subtitle: 'Tổng quan customer request',
    workspaceTab: 'overview',
    surface: 'analytics',
  },
  {
    id: 'sla',
    label: 'Nguy cơ SLA',
    subtitle: 'Danh sách nguy cơ SLA',
    workspaceTab: 'overview',
    surface: 'list',
  },
];

const extendedSavedViews: CustomerRequestSavedView[] = [
  ...savedViews,
  {
    id: 'creator',
    label: 'Người tạo cần xử lý',
    subtitle: 'Đánh giá và thông báo KH',
    workspaceTab: 'creator',
    surface: 'list',
  },
  {
    id: 'performer',
    label: 'Người xử lý đang làm',
    subtitle: 'Danh sách việc đang xử lý',
    workspaceTab: 'performer',
    surface: 'list',
  },
];

describe('CustomerRequestQuickAccessBar UI', () => {
  it('uses compact mobile empty states and still applies saved views', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    const onApplySavedView = vi.fn();

    render(
      <CustomerRequestQuickAccessBar
        savedViews={savedViews}
        activeSavedViewId={null}
        onApplySavedView={onApplySavedView}
        onClearSavedView={vi.fn()}
        pinnedItems={[]}
        recentItems={[]}
        onOpenRequest={vi.fn()}
        onRemovePinned={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở rộng/i }));
    expect(screen.getByText('Chưa có ghim.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lịch sử.')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có yêu cầu nào được ghim.')).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có lịch sử mở yêu cầu gần đây.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Toàn cảnh/i }));
    expect(onApplySavedView).toHaveBeenCalledWith(savedViews[0]);
  });

  it('shows 2 saved views first on mobile and expands on demand', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();

    render(
      <CustomerRequestQuickAccessBar
        savedViews={extendedSavedViews}
        activeSavedViewId={null}
        onApplySavedView={vi.fn()}
        onClearSavedView={vi.fn()}
        pinnedItems={[]}
        recentItems={[]}
        onOpenRequest={vi.fn()}
        onRemovePinned={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở rộng/i }));
    expect(screen.getByRole('button', { name: /Toàn cảnh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nguy cơ SLA/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Người tạo cần xử lý/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem thêm 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Xem thêm 2' }));
    expect(screen.getByRole('button', { name: /Người tạo cần xử lý/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Người xử lý đang làm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thu gọn/i })).toBeInTheDocument();
  });

  it('keeps the active saved view visible on mobile even when it is outside the top two', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();

    render(
      <CustomerRequestQuickAccessBar
        savedViews={extendedSavedViews}
        activeSavedViewId="performer"
        onApplySavedView={vi.fn()}
        onClearSavedView={vi.fn()}
        pinnedItems={[]}
        recentItems={[]}
        onOpenRequest={vi.fn()}
        onRemovePinned={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở rộng/i }));
    expect(screen.getByRole('button', { name: /Toàn cảnh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Người xử lý đang làm/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nguy cơ SLA/i })).not.toBeInTheDocument();
  });

  it('auto-collapses saved views on mobile when switching to list surface', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();

    const { rerender } = render(
      <CustomerRequestQuickAccessBar
        activeSurface="inbox"
        savedViews={extendedSavedViews}
        activeSavedViewId={null}
        onApplySavedView={vi.fn()}
        onClearSavedView={vi.fn()}
        pinnedItems={[]}
        recentItems={[]}
        onOpenRequest={vi.fn()}
        onRemovePinned={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở rộng/i }));
    await user.click(screen.getByRole('button', { name: 'Xem thêm 2' }));
    expect(screen.getByRole('button', { name: /Người tạo cần xử lý/i })).toBeInTheDocument();

    rerender(
      <CustomerRequestQuickAccessBar
        activeSurface="list"
        savedViews={extendedSavedViews}
        activeSavedViewId={null}
        onApplySavedView={vi.fn()}
        onClearSavedView={vi.fn()}
        pinnedItems={[]}
        recentItems={[]}
        onOpenRequest={vi.fn()}
        onRemovePinned={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Người tạo cần xử lý/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem thêm 2' })).toBeInTheDocument();
  });

  it('keeps full empty states on desktop', async () => {
    setViewportWidth(1600);
    const user = userEvent.setup();

    render(
      <CustomerRequestQuickAccessBar
        savedViews={savedViews}
        activeSavedViewId={null}
        onApplySavedView={vi.fn()}
        onClearSavedView={vi.fn()}
        pinnedItems={[]}
        recentItems={[]}
        onOpenRequest={vi.fn()}
        onRemovePinned={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở rộng/i }));
    expect(screen.getByText('Chưa có yêu cầu nào được ghim.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lịch sử mở yêu cầu gần đây.')).toBeInTheDocument();
  });
});
