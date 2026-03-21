import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestQuickActionModal } from '../components/customer-request/CustomerRequestQuickActionModal';
import type { CustomerRequestQuickAction } from '../components/customer-request/presentation';

describe('CustomerRequestQuickActionModal UI', () => {
  it('renders actions, selects an action, and closes from the header button', async () => {
    const user = userEvent.setup();
    const onSelectAction = vi.fn();
    const onClose = vi.fn();
    const action: CustomerRequestQuickAction = {
      id: 'assign_performer',
      label: 'Giao performer',
      description: 'Phân công người xử lý và mở form điều phối tương ứng.',
      targetStatusCode: 'in_progress',
      icon: 'person_add',
      accentCls: 'border-amber-200 bg-amber-50',
    };

    render(
      <CustomerRequestQuickActionModal
        open
        title="Điều phối nhanh"
        eyebrow="Dispatcher action"
        requestCode="CRC-202603-0007"
        requestSummary="Đồng bộ dữ liệu billing"
        actions={[action]}
        onClose={onClose}
        onSelectAction={onSelectAction}
      />
    );

    expect(screen.getByText('Điều phối nhanh')).toBeInTheDocument();
    expect(screen.getByText(/CRC-202603-0007/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Giao performer/i }));
    expect(onSelectAction).toHaveBeenCalledWith(action);

    await user.click(screen.getByRole('button', { name: /Đóng popup quick action/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
