import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Customer, Vendor } from '../types';
import { CustomerList } from '../components/CustomerList';
import { VendorList } from '../components/VendorList';

const customers: Customer[] = [
  {
    id: '1',
    uuid: 'customer-1',
    customer_code: 'KH001',
    customer_name: 'Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM',
    customer_sector: 'HEALTHCARE',
    healthcare_facility_type: 'PUBLIC_HOSPITAL',
    tax_code: '0101010101',
    address: 'Số 1 đường Trần Hưng Đạo, phường có địa chỉ rất dài để kiểm tra hiển thị wrap trên desktop và mobile',
  },
  {
    id: '2',
    uuid: 'customer-2',
    customer_code: 'KH002',
    customer_name: 'Zeta Trung tâm y tế',
    customer_sector: 'GOVERNMENT',
    tax_code: '0202020202',
    address: 'Sóc Trăng',
  },
];

const vendors: Vendor[] = [
  {
    id: 'vendor-2',
    uuid: 'vendor-2',
    vendor_code: 'DT002',
    vendor_name: 'Nhà cung cấp Zeta',
    created_at: '2026-01-02',
  },
  {
    id: 'vendor-1',
    uuid: 'vendor-1',
    vendor_code: 'DT001',
    vendor_name: 'Đối tác chiến lược rất dài để kiểm tra wrap trên desktop và responsive card layout',
    created_at: '2026-01-01',
  },
];

describe('Customer/Vendor revenue-style lists', () => {
  it('keeps customer table wrapping and responsive sort behavior after the revenue-style restyle', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={[customers[1], customers[0]]}
        onOpenModal={vi.fn()}
      />
    );

    const desktopTable = screen.getByTestId('customer-desktop-table');
    expect(desktopTable.closest('section')).toHaveClass('rounded-lg', 'border', 'overflow-hidden');
    expect(desktopTable).toHaveClass('table-fixed');
    expect(screen.queryByRole('heading', { name: 'Danh sách khách hàng' })).not.toBeInTheDocument();

    const longCustomerName = 'Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM';
    expect(within(desktopTable).getByText(longCustomerName)).toHaveClass('whitespace-normal', 'break-words', 'leading-5');

    const longAddress = 'Số 1 đường Trần Hưng Đạo, phường có địa chỉ rất dài để kiểm tra hiển thị wrap trên desktop và mobile';
    expect(within(desktopTable).getByText(longAddress)).toHaveClass('whitespace-normal', 'break-words', 'leading-5');
    expect(within(desktopTable).getByText('Y tế')).toBeInTheDocument();
    expect(within(desktopTable).getByText('Chính quyền')).toBeInTheDocument();
    expect(within(desktopTable).getByText('KH001').closest('td')).toHaveClass('align-middle');
    expect(within(desktopTable).getByText(longCustomerName).closest('td')).toHaveClass('align-middle');

    const responsiveList = screen.getByTestId('customer-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách khách hàng');
    await user.selectOptions(sortSelect, 'customer_name:asc');
    expect(sortSelect).toHaveValue('customer_name:asc');
  });

  it('renders vendor responsive cards and wraps long vendor names in the desktop table', async () => {
    const user = userEvent.setup();

    render(
      <VendorList
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Đối tác / Nhà cung cấp' })).toBeInTheDocument();
    expect(screen.queryByText('Quản lý danh sách đối tác và nhà cung cấp với cùng nhịp giao diện Quản trị Doanh thu.')).not.toBeInTheDocument();
    expect(screen.queryByText(/kết quả/)).not.toBeInTheDocument();

    const desktopTable = screen.getByTestId('vendor-desktop-table');
    expect(desktopTable).toHaveClass('table-fixed');

    const longVendorName = 'Đối tác chiến lược rất dài để kiểm tra wrap trên desktop và responsive card layout';
    expect(within(desktopTable).getByText(longVendorName)).toHaveClass('whitespace-normal', 'break-words');

    const responsiveList = screen.getByTestId('vendor-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách đối tác');
    await user.selectOptions(sortSelect, 'vendor_code:asc');
    expect(sortSelect).toHaveValue('vendor_code:asc');

    const cards = Array.from(responsiveList.querySelectorAll('article'));
    expect(cards[0]).toHaveTextContent('Đối tác chiến lược rất dài để kiểm tra wrap trên desktop và responsive card layout');
    expect(cards[1]).toHaveTextContent('Nhà cung cấp Zeta');
  });
});
