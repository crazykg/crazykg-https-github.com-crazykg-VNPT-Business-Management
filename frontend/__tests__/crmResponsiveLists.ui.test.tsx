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
    customer_code_auto_generated: true,
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
    expect(within(desktopTable).getByText('Y tế')).toBeInTheDocument();
    expect(within(desktopTable).getByText('Chính quyền')).toBeInTheDocument();
    expect(within(desktopTable).getByText('Tự sinh')).toBeInTheDocument();
    expect(within(desktopTable).getByText('KH001').closest('td')).toHaveClass('align-middle');
    expect(within(desktopTable).getByText(longCustomerName).closest('td')).toHaveClass('align-middle');

    const responsiveList = screen.getByTestId('customer-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách khách hàng');
    await user.selectOptions(sortSelect, 'customer_name:asc');
    expect(sortSelect).toHaveValue('customer_name:asc');

    const cards = Array.from(responsiveList.querySelectorAll('article'));
    expect(cards[0]).toHaveTextContent('Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM');
    expect(cards[0]).toHaveTextContent('Y tế');
    expect(cards[0]).toHaveTextContent('Tự sinh');
    expect(cards[1]).toHaveTextContent('Zeta Trung tâm y tế');
    expect(cards[1]).toHaveTextContent('Chính quyền');
  });

  it('shows healthcare KPI breakdown when the healthcare card is clicked', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByText('Tổng số khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Khách hàng Y tế')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-healthcare-kpi-breakdown')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Khách hàng Y tế/i }));

    const breakdown = screen.getByTestId('customer-healthcare-kpi-breakdown');
    expect(breakdown).toBeInTheDocument();
    expect(within(breakdown).getByText('Bệnh viện công lập')).toBeInTheDocument();
    expect(within(breakdown).getByText('1')).toBeInTheDocument();
  });

  it('filters customers by customer group using the multi-select control', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Nhóm khách hàng' }));
    await user.click(screen.getByRole('button', { name: 'Chính quyền' }));

    const responsiveList = screen.getByTestId('customer-responsive-list');
    const cards = Array.from(responsiveList.querySelectorAll('article'));

    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Zeta Trung tâm y tế');
    expect(cards[0]).toHaveTextContent('Chính quyền');
    expect(cards[0]).not.toHaveTextContent('Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM');
  });

  it('uses grouped customer KPI totals instead of pagination total in server mode', () => {
    render(
      <CustomerList
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
        paginationMeta={{
          page: 1,
          per_page: 10,
          total: 1,
          total_pages: 1,
          kpis: {
            total_customers: 2,
            healthcare_customers: 1,
            government_customers: 1,
            individual_customers: 0,
            healthcare_breakdown: {
              public_hospital: 1,
              private_hospital: 0,
              medical_center: 0,
              private_clinic: 0,
              tyt_pkdk: 0,
              other: 0,
            },
          },
        }}
        aggregateKpis={{
          totalCustomers: 2,
          healthcareCustomers: 1,
          governmentCustomers: 1,
          individualCustomers: 0,
          healthcareBreakdown: {
            publicHospital: 1,
            privateHospital: 0,
            medicalCenter: 0,
            privateClinic: 0,
            tytPkdk: 0,
            other: 0,
          },
        }}
      />
    );

    expect(screen.queryByText('2 kết quả')).not.toBeInTheDocument();
    expect(
      within(screen.getByText('Tổng số khách hàng').closest('div') as HTMLElement).getByText('2'),
    ).toBeInTheDocument();
  });
});
