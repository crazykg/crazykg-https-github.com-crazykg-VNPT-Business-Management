import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestQuickAccessBar } from '../components/customer-request/CustomerRequestQuickAccessBar';
import type {
  CustomerRequestQuickRequestItem,
  CustomerRequestSavedView,
} from '../components/customer-request/customerRequestQuickAccess';

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

const pinnedItems: CustomerRequestQuickRequestItem[] = [
  {
    requestId: '1',
    statusCode: 'in_progress',
    code: 'CRC-001',
    title: 'Yêu cầu đang ghim',
    subtitle: 'Khách hàng A',
  },
];

const recentItems: CustomerRequestQuickRequestItem[] = [
  {
    requestId: '2',
    statusCode: 'pending_dispatch',
    code: 'CRC-002',
    title: 'Yêu cầu vừa mở',
    subtitle: 'Khách hàng B',
  },
];

describe('CustomerRequestQuickAccessBar UI', () => {
  it('keeps the inbox quick access compact and hides saved-view helpers on mobile', () => {
    setViewportWidth(390);

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

    expect(screen.getByText('Truy cập nhanh')).toBeInTheDocument();
    expect(screen.queryByText('View đã lưu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Toàn cảnh/i })).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có ghim.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lịch sử.')).toBeInTheDocument();
  });

  it('keeps full empty states on desktop without the legacy saved-view section', () => {
    setViewportWidth(1600);

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

    expect(screen.getByText('Truy cập nhanh')).toBeInTheDocument();
    expect(screen.queryByText('Lối tắt đã lưu')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có yêu cầu nào được ghim.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lịch sử mở yêu cầu gần đây.')).toBeInTheDocument();
  });

  it('still lets users reopen recent requests and remove pinned ones', async () => {
    setViewportWidth(1600);
    const user = userEvent.setup();
    const onOpenRequest = vi.fn();
    const onRemovePinned = vi.fn();

    render(
      <CustomerRequestQuickAccessBar
        savedViews={savedViews}
        activeSavedViewId={null}
        onApplySavedView={vi.fn()}
        onClearSavedView={vi.fn()}
        pinnedItems={pinnedItems}
        recentItems={recentItems}
        onOpenRequest={onOpenRequest}
        onRemovePinned={onRemovePinned}
      />
    );

    await user.click(screen.getByRole('button', { name: /Yêu cầu đang ghim/i }));
    expect(onOpenRequest).toHaveBeenCalledWith(pinnedItems[0]);

    await user.click(screen.getByRole('button', { name: 'Bỏ ghim CRC-001' }));
    expect(onRemovePinned).toHaveBeenCalledWith('1');

    await user.click(screen.getByRole('button', { name: /Yêu cầu vừa mở/i }));
    expect(onOpenRequest).toHaveBeenCalledWith(recentItems[0]);
  });
});
