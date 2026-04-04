import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Customer } from '../types';
import { CustomerList } from '../components/CustomerList';

const excelTemplateSpies = vi.hoisted(() => ({
  downloadExcelTemplate: vi.fn(),
}));

vi.mock('../utils/excelTemplate', () => ({
  downloadExcelTemplate: excelTemplateSpies.downloadExcelTemplate,
}));

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
    expect(within(desktopTable).getByText(longCustomerName)).toHaveClass('max-w-[248px]', 'whitespace-normal', 'break-words', 'leading-5');

    const longAddress = 'Số 1 đường Trần Hưng Đạo, phường có địa chỉ rất dài để kiểm tra hiển thị wrap trên desktop và mobile';
    expect(within(desktopTable).getByText(longAddress)).toHaveClass('max-w-[230px]', 'whitespace-normal', 'break-words', 'leading-5');
    expect(within(desktopTable).getByText('Y tế')).toBeInTheDocument();
    expect(within(desktopTable).getByText('Chính quyền')).toBeInTheDocument();
    expect(within(desktopTable).getByText('Tự sinh')).toBeInTheDocument();
    expect(within(desktopTable).getByText('KH001').closest('td')).toHaveClass('align-middle');
    expect(within(desktopTable).getByText(longCustomerName).closest('td')).toHaveClass('align-middle');

    const responsiveList = screen.getByTestId('customer-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');
    expect(screen.queryByRole('heading', { name: 'Danh sách khách hàng' })).not.toBeInTheDocument();

    const groupFilterButton = screen.getByRole('button', { name: 'Nhóm khách hàng' });
    expect(groupFilterButton.className).toContain('!h-8');
    expect(groupFilterButton.className).toContain('!min-h-0');

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

  it('filters the customer list when a healthcare breakdown card is clicked', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Khách hàng Y tế/i }));
    await user.click(screen.getByRole('button', { name: /Bệnh viện công lập/i }));

    const responsiveList = screen.getByTestId('customer-responsive-list');
    const cards = Array.from(responsiveList.querySelectorAll('article'));

    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM');
    expect(cards[0]).not.toHaveTextContent('Zeta Trung tâm y tế');
    expect(screen.getByText('Loại hình Y tế: Bệnh viện công lập')).toBeInTheDocument();
  });

  it('filters customers by customer group using the multi-select control', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    const groupFilterButton = screen.getByRole('button', { name: 'Nhóm khách hàng' });
    await user.click(groupFilterButton);
    await user.click(screen.getByRole('button', { name: 'Chính quyền' }));
    await user.click(screen.getByPlaceholderText('Tìm mã KH, tên khách hàng, mã số thuế...'));

    const responsiveList = screen.getByTestId('customer-responsive-list');
    const cards = Array.from(responsiveList.querySelectorAll('article'));

    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Zeta Trung tâm y tế');
    expect(cards[0]).toHaveTextContent('Chính quyền');
    expect(cards[0]).not.toHaveTextContent('Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM');
    expect(groupFilterButton).toHaveTextContent('Chính quyền');
    expect(screen.queryByRole('button', { name: /Chính quyền close/i })).not.toBeInTheDocument();
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
      screen.getByText((content, element) =>
        content.trim() === '2'
        && element?.tagName.toLowerCase() === 'p'
        && element.className.includes('text-xl')
        && element.parentElement?.textContent?.includes('Tổng số khách hàng') === true,
      ),
    ).toBeInTheDocument();
  });

  it('includes healthcare facility type in server queries when a breakdown card is selected', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <CustomerList
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={onQueryChange}
        paginationMeta={{
          page: 1,
          per_page: 10,
          total: 2,
          total_pages: 1,
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

    await user.click(screen.getByRole('button', { name: /Khách hàng Y tế/i }));
    await user.click(screen.getByRole('button', { name: /Bệnh viện công lập/i }));

    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
      filters: {
        healthcare_facility_type: 'PUBLIC_HOSPITAL',
      },
    }));
  });

  it('downloads a complete customer import template with 10 sample rows', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={customers}
        onOpenModal={vi.fn()}
        canImport
      />
    );

    await user.click(screen.getByRole('button', { name: /Nhập/i }));
    await user.click(screen.getByRole('button', { name: /Tải file mẫu/i }));

    expect(excelTemplateSpies.downloadExcelTemplate).toHaveBeenCalledTimes(1);
    expect(excelTemplateSpies.downloadExcelTemplate).toHaveBeenCalledWith(
      'mau_nhap_khach_hang',
      'KhachHang',
      ['Mã khách hàng', 'Tên khách hàng', 'Nhóm khách hàng', 'Loại hình cơ sở y tế', 'Quy mô giường bệnh', 'Mã số thuế', 'Địa chỉ'],
      expect.any(Array),
    );

    const [, , , rows] = excelTemplateSpies.downloadExcelTemplate.mock.calls[0];
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual([
      '93002',
      'Trung tâm Y tế khu vực Vị Thủy',
      'Y tế',
      'Trung tâm Y tế',
      '320',
      '0127160495',
      'Số 02 Nguyễn Trãi, Vị Thủy, Hậu Giang',
    ]);
    expect(rows).toContainEqual([
      'CQ001',
      'UBND Phường Vị Thanh',
      'Chính quyền',
      '',
      '',
      '1800999001',
      'Phường I, Vị Thanh, Hậu Giang',
    ]);
    expect(rows).toContainEqual([
      'CN001',
      'Nguyễn Văn An',
      'Cá nhân',
      '',
      '',
      '',
      'Long Mỹ, Hậu Giang',
    ]);
    expect(rows[9]).toEqual([
      'KHAC01',
      'Công ty TNHH Thiết bị Y tế Minh Phúc',
      'Khác',
      '',
      '',
      '0312345678',
      'Ninh Kiều, Cần Thơ',
    ]);
  });
});
