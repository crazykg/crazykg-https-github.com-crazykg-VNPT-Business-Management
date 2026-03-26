import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Customer } from '../types';
import { CustomerList } from '../components/CustomerList';

const customers: Customer[] = [
  {
    id: '1',
    uuid: 'customer-1',
    customer_code: 'KH001',
    customer_name: 'Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM',
    tax_code: '0101010101',
    address: 'Số 1 đường Trần Hưng Đạo, phường có địa chỉ rất dài để kiểm tra hiển thị wrap trên desktop và mobile',
  },
  {
    id: '2',
    uuid: 'customer-2',
    customer_code: 'KH002',
    customer_name: 'Zeta Trung tâm y tế',
    tax_code: '0202020202',
    address: 'Sóc Trăng',
  },
];

describe('CRM responsive list screens', () => {
  it('keeps long customer names and addresses wrapped in the customer desktop table and supports small-screen sorting', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={[customers[1], customers[0]]}
        onOpenModal={vi.fn()}
      />
    );

    const desktopTable = screen.getByTestId('customer-desktop-table');
    expect(desktopTable).toHaveClass('table-fixed');

    const longCustomerName = 'Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM';
    expect(within(desktopTable).getByText(longCustomerName)).toHaveClass('whitespace-normal', 'break-words', 'leading-6');

    const longAddress = 'Số 1 đường Trần Hưng Đạo, phường có địa chỉ rất dài để kiểm tra hiển thị wrap trên desktop và mobile';
    expect(within(desktopTable).getByText(longAddress)).toHaveClass('whitespace-normal', 'break-words', 'leading-6');

    const responsiveList = screen.getByTestId('customer-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách khách hàng');
    await user.selectOptions(sortSelect, 'customer_name:asc');
    expect(sortSelect).toHaveValue('customer_name:asc');

    const cards = Array.from(responsiveList.querySelectorAll('article'));
    expect(cards[0]).toHaveTextContent('Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM');
    expect(cards[1]).toHaveTextContent('Zeta Trung tâm y tế');
  });
});
