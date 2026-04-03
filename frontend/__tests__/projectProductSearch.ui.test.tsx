import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFormModal } from '../components/modals';
import type { Customer, ProcedureTemplate, Product, Project } from '../types';

const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());

fetchProcedureTemplatesMock.mockResolvedValue([
  {
    id: 1,
    template_code: 'DAU_TU',
    template_name: 'Đầu tư',
    is_active: true,
    phases: ['CHUAN_BI', 'THUC_HIEN_DAU_TU'],
  },
] as ProcedureTemplate[]);

vi.mock('../services/v5Api', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
  deleteUploadedDocumentAttachment: vi.fn(),
  uploadDocumentAttachment: vi.fn(),
  uploadFeedbackAttachment: vi.fn(),
  deleteUploadedFeedbackAttachment: vi.fn(),
}));

describe('Project product search dropdown', () => {
  it('searches products by code, name, unit, and price while showing a 4-column dropdown', async () => {
    const user = userEvent.setup();
    const products: Product[] = [
      {
        id: 1,
        product_code: 'SOC_MON',
        product_name: 'Dịch vụ giám sát SOC',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 180000000,
        unit: 'Gói/Năm',
        description: null,
      },
      {
        id: 2,
        product_code: 'EMR_BASIC',
        product_name: 'Phần mềm Bệnh án điện tử',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 2500000,
        unit: 'Người dùng/Tháng',
        description: null,
      },
    ];

    const projectData: Partial<Project> = {
      id: 99,
      project_code: 'DA099',
      project_name: 'Dự án test sản phẩm',
      customer_id: null,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      start_date: '2026-03-28',
      items: [
        {
          id: 'ITEM_1',
          productId: '',
          product_id: null,
          quantity: 1,
          unitPrice: 0,
          unit_price: 0,
          discountPercent: 0,
          discountAmount: 0,
          lineTotal: 0,
          line_total: 0,
        },
      ],
      raci: [],
    };

    render(
      <ProjectFormModal
        type="EDIT"
        data={projectData as Project}
        initialTab="items"
        customers={[]}
        products={products}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm/i }));

    const dropdownHeader = screen.getByText('Mã SP').closest('div');
    expect(dropdownHeader).not.toBeNull();
    expect(within(dropdownHeader as HTMLElement).getByText('Mã SP')).toBeInTheDocument();
    expect(within(dropdownHeader as HTMLElement).getByText('Tên SP')).toBeInTheDocument();
    expect(within(dropdownHeader as HTMLElement).getByText('ĐVT')).toBeInTheDocument();
    expect(within(dropdownHeader as HTMLElement).getByText('Đơn giá')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm...');

    await user.type(searchInput, 'SOC_MON');
    expect(screen.getByText('Dịch vụ giám sát SOC')).toBeInTheDocument();
    expect(screen.queryByText('Phần mềm Bệnh án điện tử')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'Bệnh án điện tử');
    expect(screen.getByText('Phần mềm Bệnh án điện tử')).toBeInTheDocument();
    expect(screen.queryByText('Dịch vụ giám sát SOC')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'Gói/Năm');
    expect(screen.getByText('Dịch vụ giám sát SOC')).toBeInTheDocument();
    expect(screen.queryByText('Phần mềm Bệnh án điện tử')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, '180000000');
    expect(screen.getByText('Dịch vụ giám sát SOC')).toBeInTheDocument();
    expect(screen.queryByText('Phần mềm Bệnh án điện tử')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, '180.000.000');
    const socOption = screen.getByText('Dịch vụ giám sát SOC').closest('button');
    expect(socOption).not.toBeNull();
    expect(within(socOption as HTMLElement).getByText('SOC_MON')).toBeInTheDocument();
    expect(within(socOption as HTMLElement).getByText('Gói/Năm')).toBeInTheDocument();
    expect(within(socOption as HTMLElement).getByText('180.000.000')).toBeInTheDocument();

    await user.click(socOption as HTMLElement);

    expect(screen.getByRole('button', { name: /SOC_MON - Dịch vụ giám sát SOC/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('180.000.000')).toBeInTheDocument();
  });

  it('supports ArrowDown, ArrowUp, and Enter when choosing a searched project product', async () => {
    const user = userEvent.setup();
    const products: Product[] = [
      {
        id: 1,
        product_code: 'LIS_PER',
        product_name: 'Phần mềm quản lý xét nghiệm VNPT LIS',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 30000000,
        unit: 'Máy',
        description: null,
      },
      {
        id: 2,
        product_code: 'LIS_SUB',
        product_name: 'Phần mềm quản lý xét nghiệm VNPT LIS',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 500000,
        unit: 'Máy',
        description: null,
      },
      {
        id: 3,
        product_code: 'LIS_ADDON',
        product_name: 'Gói mở rộng VNPT LIS',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 7500000,
        unit: 'Gói',
        description: null,
      },
    ];

    const projectData: Partial<Project> = {
      id: 100,
      project_code: 'DA100',
      project_name: 'Dự án test keyboard sản phẩm',
      customer_id: null,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      start_date: '2026-03-28',
      items: [
        {
          id: 'ITEM_2',
          productId: '',
          product_id: null,
          quantity: 1,
          unitPrice: 0,
          unit_price: 0,
          discountPercent: 0,
          discountAmount: 0,
          lineTotal: 0,
          line_total: 0,
        },
      ],
      raci: [],
    };

    render(
      <ProjectFormModal
        type="EDIT"
        data={projectData as Project}
        initialTab="items"
        customers={[]}
        products={products}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm/i }));

    const searchInput = screen.getByPlaceholderText('Tìm kiếm...');
    await user.type(searchInput, 'LIS');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByRole('button', { name: /LIS_SUB - Phần mềm quản lý xét nghiệm VNPT LIS/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('500.000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /LIS_SUB - Phần mềm quản lý xét nghiệm VNPT LIS/i }));
    const reopenedSearchInput = screen.getByPlaceholderText('Tìm kiếm...');
    await user.type(reopenedSearchInput, 'LIS');
    await user.keyboard('{ArrowUp}{Enter}');

    expect(screen.getByRole('button', { name: /LIS_PER - Phần mềm quản lý xét nghiệm VNPT LIS/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('30.000.000')).toBeInTheDocument();
  });

  it('hides HMIS and HSSK products for medical centers in the project item tab', async () => {
    const user = userEvent.setup();
    const customers: Customer[] = [
      {
        id: 1,
        uuid: 'customer-medical-center',
        customer_code: 'KH001',
        customer_name: 'Trung tâm Y tế Long Mỹ',
        tax_code: '6300000001',
        address: 'Hậu Giang',
        customer_sector: 'HEALTHCARE',
        healthcare_facility_type: 'MEDICAL_CENTER',
        bed_capacity: 50,
      },
    ];
    const products: Product[] = [
      {
        id: 1,
        product_code: 'HMIS_CORE',
        product_name: 'Gói HMIS nền tảng',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 20000000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 2,
        product_code: 'HSSK_FAMILY',
        product_name: 'HSSK hồ sơ sức khỏe gia đình',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 5000000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 3,
        product_code: 'VNPT_HIS_3',
        product_name: 'Gói VNPT-HIS-3',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 10000000,
        unit: 'Gói',
        description: null,
      },
    ];

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          id: 101,
          project_code: 'DA101',
          project_name: 'Dự án y tế',
          customer_id: 1,
          status: 'CHUAN_BI',
          investment_mode: 'DAU_TU',
          start_date: '2026-03-28',
          items: [
            {
              id: 'ITEM_3',
              productId: '',
              product_id: null,
              quantity: 1,
              unitPrice: 0,
              unit_price: 0,
              discountPercent: 0,
              discountAmount: 0,
              lineTotal: 0,
              line_total: 0,
            },
          ],
          raci: [],
        } as Project}
        initialTab="items"
        customers={customers}
        products={products}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm/i }));

    expect(screen.queryByText('HMIS_CORE')).not.toBeInTheDocument();
    expect(screen.queryByText('HSSK_FAMILY')).not.toBeInTheDocument();
    expect(screen.getByText('VNPT_HIS_3')).toBeInTheDocument();
  });

  it('hides HMIS and HSSK products for hospitals with bed capacity in the project item tab', async () => {
    const user = userEvent.setup();
    const customers: Customer[] = [
      {
        id: 2,
        uuid: 'customer-hospital',
        customer_code: 'KH002',
        customer_name: 'Bệnh viện Đa khoa Tỉnh',
        tax_code: '6300000002',
        address: 'Cần Thơ',
        customer_sector: 'HEALTHCARE',
        healthcare_facility_type: 'PUBLIC_HOSPITAL',
        bed_capacity: 300,
      },
    ];
    const products: Product[] = [
      {
        id: 1,
        product_code: 'HMIS_ADV',
        product_name: 'Gói HMIS nâng cao',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 25000000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 2,
        product_code: 'HSSK_SYNC',
        product_name: 'HSSK đồng bộ dữ liệu',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 4500000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 3,
        product_code: 'VNPT_HIS_5',
        product_name: 'Gói VNPT-HIS-5',
        package_name: null,
        domain_id: 1,
        vendor_id: 1,
        standard_price: 22000000,
        unit: 'Gói',
        description: null,
      },
    ];

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          id: 102,
          project_code: 'DA102',
          project_name: 'Dự án bệnh viện',
          customer_id: 2,
          status: 'CHUAN_BI',
          investment_mode: 'DAU_TU',
          start_date: '2026-03-28',
          items: [
            {
              id: 'ITEM_4',
              productId: '',
              product_id: null,
              quantity: 1,
              unitPrice: 0,
              unit_price: 0,
              discountPercent: 0,
              discountAmount: 0,
              lineTotal: 0,
              line_total: 0,
            },
          ],
          raci: [],
        } as Project}
        initialTab="items"
        customers={customers}
        products={products}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm/i }));

    expect(screen.queryByText('HMIS_ADV')).not.toBeInTheDocument();
    expect(screen.queryByText('HSSK_SYNC')).not.toBeInTheDocument();
    expect(screen.getByText('VNPT_HIS_5')).toBeInTheDocument();
  });
});
