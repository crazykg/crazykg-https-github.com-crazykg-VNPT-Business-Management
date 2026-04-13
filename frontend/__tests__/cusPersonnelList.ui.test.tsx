import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Customer, CustomerPersonnel, SupportContactPosition } from '../types';
import { CusPersonnelList } from '../components/CusPersonnelList';

const customers: Customer[] = [
  {
    id: '1',
    uuid: 'customer-1',
    customer_code: 'KH001',
    customer_name: 'Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive desktop',
    tax_code: '0101010101',
    address: 'Can Tho',
  },
  {
    id: '2',
    uuid: 'customer-2',
    customer_code: 'KH002',
    customer_name: 'Zeta Trung tâm y tế',
    tax_code: '0202020202',
    address: 'Soc Trang',
  },
];

const supportContactPositions: SupportContactPosition[] = [
  {
    id: 'p1',
    position_code: 'DAU_MOI',
    position_name: 'Đầu mối',
    is_active: true,
  },
];

const personnel: CustomerPersonnel[] = [
  {
    id: 'row-1',
    customerId: '2',
    fullName: 'Nguyễn Minh Tuấn',
    birthday: '1999-12-12',
    positionType: 'DAU_MOI',
    positionId: 'p1',
    phoneNumber: '0900000004',
    email: 'tuanmn@example.com',
    status: 'Active',
  },
  {
    id: 'row-2',
    customerId: '1',
    fullName: 'Đầu mối Trung tâm Y tế khu vực có họ và tên rất dài để kiểm tra wrap',
    birthday: '1997-09-07',
    positionType: 'DAU_MOI',
    positionId: 'p1',
    phoneNumber: '0900000006',
    email: 'dunv@example.com',
    status: 'Active',
  },
];

describe('CusPersonnelList UI', () => {
  it('wraps long customer and contact names in the desktop table instead of truncating them', () => {
    render(
      <CusPersonnelList
        personnel={personnel}
        customers={customers}
        supportContactPositions={supportContactPositions}
        onOpenModal={vi.fn()}
      />
    );

    const desktopTable = screen.getByTestId('cus-personnel-desktop-table');
    expect(desktopTable).toHaveClass('table-fixed');

    const longCustomerText = 'KH001 - Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive desktop';
    const customerCellContent = within(desktopTable).getByText(longCustomerText);
    expect(customerCellContent).toHaveClass('whitespace-normal', 'break-words', 'leading-5');
    expect(customerCellContent.closest('td')).not.toHaveClass('truncate');

    const longFullName = 'Đầu mối Trung tâm Y tế khu vực có họ và tên rất dài để kiểm tra wrap';
    expect(within(desktopTable).getByText(longFullName)).toHaveClass('whitespace-normal', 'break-words', 'leading-5');
  });

  it('renders the mobile/tablet card layout and lets users sort from the small-screen control', async () => {
    const user = userEvent.setup();

    render(
      <CusPersonnelList
        personnel={personnel}
        customers={customers}
        supportContactPositions={supportContactPositions}
        onOpenModal={vi.fn()}
      />
    );

    const responsiveList = screen.getByTestId('cus-personnel-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách');
    expect(sortSelect).toHaveValue('');

    await user.selectOptions(sortSelect, 'customerId:asc');

    expect(sortSelect).toHaveValue('customerId:asc');

    const cards = Array.from(responsiveList.querySelectorAll('article'));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('KH001 - Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive desktop');
    expect(cards[1]).toHaveTextContent('KH002 - Zeta Trung tâm y tế');
  });
});
