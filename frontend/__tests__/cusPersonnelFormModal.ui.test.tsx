import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CusPersonnelFormModal } from '../components/modals';
import type { Customer, CustomerPersonnel, SupportContactPosition } from '../types';

const customers: Customer[] = [
  {
    id: '1',
    uuid: 'customer-1',
    customer_code: '93007',
    customer_name: 'Bệnh viện Sản - Nhi Hậu Giang',
    tax_code: '1800000001',
    address: 'Hậu Giang',
  },
];

const supportContactPositions: SupportContactPosition[] = [
  {
    id: 'p1',
    position_code: 'DAU_MOI',
    position_name: 'Đầu mối',
    is_active: true,
  },
  {
    id: 'p2',
    position_code: 'GIAM_DOC',
    position_name: 'Giám đốc',
    is_active: true,
  },
  {
    id: 'p3',
    position_code: 'TRUONG_PHONG',
    position_name: 'Trưởng phòng',
    is_active: true,
  },
];

const existingPersonnel: CustomerPersonnel = {
  id: 'cp-1',
  customerId: '1',
  fullName: 'Hồ Sơn Tùng',
  birthday: '1988-10-20',
  positionType: 'DAU_MOI',
  positionId: 'p1',
  positionLabel: 'Đầu mối',
  phoneNumber: '0912345678',
  email: 'contact.93007@vnpt.local',
  status: 'Active',
};

describe('CusPersonnelFormModal', () => {
  it('renders the position dropdown in a portal so it is not clipped by the modal frame', async () => {
    const user = userEvent.setup();

    render(
      <CusPersonnelFormModal
        type="EDIT"
        data={existingPersonnel}
        customers={customers}
        supportContactPositions={supportContactPositions}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const positionField = screen.getByText('Chức vụ', { selector: 'label' }).closest('div');
    const positionTrigger = positionField?.querySelector('[role="button"]');

    expect(positionTrigger).not.toBeNull();
    await user.click(positionTrigger as HTMLElement);

    const dropdownSearchInput = screen.getByPlaceholderText('Tìm kiếm...');
    await waitFor(() => {
      const portalDropdown = dropdownSearchInput.closest('div[style]');
      expect(portalDropdown).toHaveStyle({ position: 'fixed' });
    });

    expect(screen.getByRole('button', { name: 'Giám đốc' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Trưởng phòng' })).toBeVisible();
  });
});
