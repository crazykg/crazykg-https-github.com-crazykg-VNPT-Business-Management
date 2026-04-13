import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFormModal } from '../components/modals';
import type { Customer, ProcedureTemplate, Product, ProductPackage, Project } from '../types';

const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());
const fetchProjectImplementationUnitOptionsMock = vi.hoisted(() => vi.fn());
const fetchProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const generateProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const syncProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());

fetchProcedureTemplatesMock.mockResolvedValue([
  {
    id: 1,
    template_code: 'DAU_TU',
    template_name: 'Đầu tư',
    is_active: true,
    phases: ['CHUAN_BI', 'THUC_HIEN_DAU_TU'],
  },
] as ProcedureTemplate[]);

fetchProjectImplementationUnitOptionsMock.mockResolvedValue([]);
fetchProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });
generateProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });
syncProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });

vi.mock('../services/v5Api', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
  fetchProjectRevenueSchedules: fetchProjectRevenueSchedulesMock,
  generateProjectRevenueSchedules: generateProjectRevenueSchedulesMock,
  syncProjectRevenueSchedules: syncProjectRevenueSchedulesMock,
  deleteUploadedDocumentAttachment: vi.fn(),
  uploadDocumentAttachment: vi.fn(),
  uploadFeedbackAttachment: vi.fn(),
  deleteUploadedFeedbackAttachment: vi.fn(),
}));

vi.mock('../services/api/projectApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/projectApi')>(
    '../services/api/projectApi'
  );

  return {
    ...actual,
    fetchProjectImplementationUnitOptions:
      fetchProjectImplementationUnitOptionsMock,
  };
});

describe('Project product search dropdown', () => {
  it('searches project packages by code, name, unit, and price while showing a 4-column dropdown', async () => {
    const user = userEvent.setup();
    const products: Product[] = [
      {
        id: 11,
        product_code: 'SOC_PARENT',
        product_name: 'Nền tảng SOC',
        domain_id: 1,
        vendor_id: 1,
        standard_price: 180000000,
        unit: 'Gói/Năm',
      },
      {
        id: 12,
        product_code: 'EMR_PARENT',
        product_name: 'Nền tảng EMR',
        domain_id: 1,
        vendor_id: 1,
        standard_price: 2500000,
        unit: 'Người dùng/Tháng',
      },
    ];
    const productPackages: ProductPackage[] = [
      {
        id: 1,
        product_id: 11,
        package_code: 'SOC_MON',
        package_name: 'Dịch vụ giám sát SOC',
        product_name: 'Nền tảng SOC',
        parent_product_code: 'SOC_PARENT',
        standard_price: 180000000,
        unit: null,
        description: null,
      },
      {
        id: 2,
        product_id: 12,
        package_code: 'EMR_BASIC',
        package_name: 'Phần mềm Bệnh án điện tử',
        product_name: 'Nền tảng EMR',
        parent_product_code: 'EMR_PARENT',
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
        productPackages={productPackages}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn hạng mục/i }));

    expect(screen.getAllByRole('button', { name: /Chọn hạng mục/i })).toHaveLength(1);

    const dropdownHeader = screen.getByText('Mã gói').closest('div');
    expect(dropdownHeader).not.toBeNull();
    expect(within(dropdownHeader as HTMLElement).getByText('Mã gói')).toBeInTheDocument();
    expect(within(dropdownHeader as HTMLElement).getByText('Tên hạng mục')).toBeInTheDocument();
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

    const selectedPackageButton = screen.getByRole('button', { name: /Dịch vụ giám sát SOC/i });
    expect(selectedPackageButton).toHaveClass('h-8', 'text-xs');
    expect(selectedPackageButton).not.toHaveTextContent('SOC_MON');
    expect(screen.getByText('Gói/Năm').closest('div')).toHaveClass('h-8', 'text-xs');
    expect(screen.getByDisplayValue('180.000.000')).toHaveClass('h-8', 'text-xs');
  });

  it('supports ArrowDown, ArrowUp, and Enter when choosing a searched project package', async () => {
    const user = userEvent.setup();
    const productPackages: ProductPackage[] = [
      {
        id: 1,
        product_id: 21,
        package_code: 'LIS_PER',
        package_name: 'Phần mềm quản lý xét nghiệm VNPT LIS',
        product_name: 'VNPT LIS',
        parent_product_code: 'LIS_PARENT',
        standard_price: 30000000,
        unit: 'Máy',
        description: null,
      },
      {
        id: 2,
        product_id: 22,
        package_code: 'LIS_SUB',
        package_name: 'Phần mềm quản lý xét nghiệm VNPT LIS',
        product_name: 'VNPT LIS',
        parent_product_code: 'LIS_PARENT',
        standard_price: 500000,
        unit: 'Máy',
        description: null,
      },
      {
        id: 3,
        product_id: 23,
        package_code: 'LIS_ADDON',
        package_name: 'Gói mở rộng VNPT LIS',
        product_name: 'VNPT LIS',
        parent_product_code: 'LIS_PARENT',
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
        products={[]}
        productPackages={productPackages}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn hạng mục/i }));

    const searchInput = screen.getByPlaceholderText('Tìm kiếm...');
    await user.type(searchInput, 'LIS');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByRole('button', { name: /Phần mềm quản lý xét nghiệm VNPT LIS/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('500.000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Phần mềm quản lý xét nghiệm VNPT LIS/i }));
    const reopenedSearchInput = screen.getByPlaceholderText('Tìm kiếm...');
    await user.type(reopenedSearchInput, 'LIS');
    await user.keyboard('{ArrowUp}{Enter}');

    expect(screen.getByRole('button', { name: /Phần mềm quản lý xét nghiệm VNPT LIS/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('30.000.000')).toBeInTheDocument();
  });

  it('moves focus across project item fields with Enter and returns to the next row selector after discount', async () => {
    const user = userEvent.setup();
    const productPackages: ProductPackage[] = [
      {
        id: 11,
        product_id: 51,
        package_code: 'HIS_CLOUD',
        package_name: 'VNPT HIS Cloud',
        product_name: 'VNPT HIS',
        parent_product_code: 'HIS_PARENT',
        standard_price: 22000000,
        unit: 'Gói/Tháng',
        description: null,
      },
    ];

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          id: 103,
          project_code: 'DA103',
          project_name: 'Dự án test Enter hạng mục',
          customer_id: null,
          status: 'CHUAN_BI',
          investment_mode: 'DAU_TU',
          start_date: '2026-03-28',
          items: [
            {
              id: 'ITEM_ENTER_1',
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
        customers={[]}
        products={[]}
        productPackages={productPackages}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn hạng mục/i }));

    const searchInput = screen.getByPlaceholderText('Tìm kiếm...');
    await user.type(searchInput, 'HIS');
    await user.keyboard('{ArrowDown}{Enter}');

    const selectedCatalogButton = screen.getByRole('button', { name: /VNPT HIS Cloud/i });
    expect(selectedCatalogButton).toBeInTheDocument();
    selectedCatalogButton.focus();
    expect(selectedCatalogButton).toHaveFocus();

    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByLabelText(/Số lượng hạng mục dòng 1/i)).toHaveFocus();
    });

    await user.keyboard('{Enter}');
    expect(screen.getByLabelText(/Đơn giá hạng mục dòng 1/i)).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByLabelText(/Phần trăm chiết khấu hạng mục dòng 1/i)).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByLabelText(/Giảm giá hạng mục dòng 1/i)).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Chọn hạng mục/i })).toHaveLength(1);
      expect(screen.getByRole('button', { name: /Chọn hạng mục/i })).toHaveFocus();
    });
  });

  it('copies a project item row, focuses the copied selector, and warns about duplicates immediately', async () => {
    const user = userEvent.setup();
    const productPackages: ProductPackage[] = [
      {
        id: 21,
        product_id: 61,
        package_code: 'LIS_PER',
        package_name: 'Phần mềm quản lý xét nghiệm VNPT LIS',
        product_name: 'VNPT LIS',
        parent_product_code: 'LIS_PARENT',
        standard_price: 30000000,
        unit: 'Máy',
        description: null,
      },
      {
        id: 22,
        product_id: 62,
        package_code: 'LIS_ADDON',
        package_name: 'Gói mở rộng VNPT LIS',
        product_name: 'VNPT LIS',
        parent_product_code: 'LIS_PARENT',
        standard_price: 7500000,
        unit: 'Gói',
        description: null,
      },
    ];

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          id: 104,
          project_code: 'DA104',
          project_name: 'Dự án test copy hạng mục',
          customer_id: null,
          status: 'CHUAN_BI',
          investment_mode: 'DAU_TU',
          start_date: '2026-03-28',
          items: [
            {
              id: 'ITEM_COPY_1',
              productId: '61',
              product_id: 61,
              productPackageId: 21,
              product_package_id: 21,
              quantity: 1,
              unitPrice: 30000000,
              unit_price: 30000000,
              discountPercent: 0,
              discountAmount: 0,
              lineTotal: 30000000,
              line_total: 30000000,
            },
          ],
          raci: [],
        } as Project}
        initialTab="items"
        customers={[]}
        products={[]}
        productPackages={productPackages}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Sao chép hạng mục dòng 1/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Có hạng mục đang bị trùng trong cùng dự án\./i)
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', {
          name: /Phần mềm quản lý xét nghiệm VNPT LIS/i,
        })
      ).toHaveLength(2);
      expect(
        screen.getAllByRole('button', {
          name: /Phần mềm quản lý xét nghiệm VNPT LIS/i,
        })[1]
      ).toHaveFocus();
    });
  });

  it('allows selecting the same project item twice and only shows a warning banner', async () => {
    const user = userEvent.setup();
    const productPackages: ProductPackage[] = [
      {
        id: 21,
        product_id: 61,
        package_code: 'LIS_PER',
        package_name: 'Phần mềm quản lý xét nghiệm VNPT LIS',
        product_name: 'VNPT LIS',
        parent_product_code: 'LIS_PARENT',
        standard_price: 30000000,
        unit: 'Máy',
        description: null,
      },
      {
        id: 22,
        product_id: 62,
        package_code: 'LIS_ADDON',
        package_name: 'Gói mở rộng VNPT LIS',
        product_name: 'VNPT LIS',
        parent_product_code: 'LIS_PARENT',
        standard_price: 7500000,
        unit: 'Gói',
        description: null,
      },
    ];

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          id: 105,
          project_code: 'DA105',
          project_name: 'Dự án chọn trùng hạng mục',
          customer_id: null,
          status: 'CHUAN_BI',
          investment_mode: 'DAU_TU',
          start_date: '2026-03-28',
          items: [
            {
              id: 'ITEM_DUP_1',
              productId: '61',
              product_id: 61,
              productPackageId: 21,
              product_package_id: 21,
              quantity: 1,
              unitPrice: 30000000,
              unit_price: 30000000,
              discountPercent: 0,
              discountAmount: 0,
              lineTotal: 30000000,
              line_total: 30000000,
            },
          ],
          raci: [],
        } as Project}
        initialTab="items"
        customers={[]}
        products={[]}
        productPackages={productPackages}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Thêm hạng mục/i }));
    await user.click(screen.getByRole('button', { name: /Chọn hạng mục/i }));
    const duplicateOption = screen
      .getAllByRole('button', {
        name: /Phần mềm quản lý xét nghiệm VNPT LIS/i,
      })
      .at(-1);
    expect(duplicateOption).toBeDefined();
    await user.click(duplicateOption as HTMLElement);

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', {
          name: /Phần mềm quản lý xét nghiệm VNPT LIS/i,
        })
      ).toHaveLength(2);
    });

    expect(
      screen.getByText(
        /Có hạng mục đang bị trùng trong cùng dự án\. Hệ thống chỉ cảnh báo để bạn kiểm tra lại, nhưng vẫn cho phép cập nhật dự án\./i
      )
    ).toBeInTheDocument();
  });

  it('hides HMIS and HSSK packages for medical centers in the project item tab', async () => {
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
    const productPackages: ProductPackage[] = [
      {
        id: 1,
        product_id: 31,
        package_code: 'HMIS_CORE',
        package_name: 'Gói HMIS nền tảng',
        product_name: 'HMIS',
        parent_product_code: 'HMIS_PARENT',
        standard_price: 20000000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 2,
        product_id: 32,
        package_code: 'HSSK_FAMILY',
        package_name: 'HSSK hồ sơ sức khỏe gia đình',
        product_name: 'HSSK',
        parent_product_code: 'HSSK_PARENT',
        standard_price: 5000000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 3,
        product_id: 33,
        package_code: 'VNPT_HIS_3',
        package_name: 'Gói VNPT-HIS-3',
        product_name: 'VNPT HIS',
        parent_product_code: 'HIS_PARENT',
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
        products={[]}
        productPackages={productPackages}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn hạng mục/i }));

    expect(screen.queryByText('HMIS_CORE')).not.toBeInTheDocument();
    expect(screen.queryByText('HSSK_FAMILY')).not.toBeInTheDocument();
    expect(screen.getByText('VNPT_HIS_3')).toBeInTheDocument();
  });

  it('hides HMIS and HSSK packages for hospitals with bed capacity in the project item tab', async () => {
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
    const productPackages: ProductPackage[] = [
      {
        id: 1,
        product_id: 41,
        package_code: 'HMIS_ADV',
        package_name: 'Gói HMIS nâng cao',
        product_name: 'HMIS',
        parent_product_code: 'HMIS_PARENT',
        standard_price: 25000000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 2,
        product_id: 42,
        package_code: 'HSSK_SYNC',
        package_name: 'HSSK đồng bộ dữ liệu',
        product_name: 'HSSK',
        parent_product_code: 'HSSK_PARENT',
        standard_price: 4500000,
        unit: 'Gói',
        description: null,
      },
      {
        id: 3,
        product_id: 43,
        package_code: 'VNPT_HIS_5',
        package_name: 'Gói VNPT-HIS-5',
        product_name: 'VNPT HIS',
        parent_product_code: 'HIS_PARENT',
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
        products={[]}
        productPackages={productPackages}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Chọn hạng mục/i }));

    expect(screen.queryByText('HMIS_ADV')).not.toBeInTheDocument();
    expect(screen.queryByText('HSSK_SYNC')).not.toBeInTheDocument();
    expect(screen.getByText('VNPT_HIS_5')).toBeInTheDocument();
  });
});
