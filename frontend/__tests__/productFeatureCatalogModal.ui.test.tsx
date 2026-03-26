import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductFeatureCatalog } from '../types';
import { ProductFeatureCatalogModal } from '../components/ProductFeatureCatalogModal';

const apiSpies = vi.hoisted(() => ({
  fetchProductFeatureCatalog: vi.fn(),
  updateProductFeatureCatalog: vi.fn(),
}));

vi.mock('../services/v5Api', () => ({
  fetchProductFeatureCatalog: apiSpies.fetchProductFeatureCatalog,
  updateProductFeatureCatalog: apiSpies.updateProductFeatureCatalog,
}));

vi.mock('../utils/excelTemplate', () => ({
  downloadExcelWorkbook: vi.fn(),
}));

vi.mock('../utils/exportUtils', () => ({
  exportPdfTable: vi.fn(() => true),
  isoDateStamp: vi.fn(() => '2026-03-25'),
}));

vi.mock('../utils/importParser', () => ({
  parseImportFile: vi.fn(),
}));

vi.mock('../components/Modals', () => ({
  ModalWrapper: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
  ImportModal: ({
    title,
    onClose,
    onSave,
    isLoading,
  }: {
    title: string;
    onClose: () => void;
    onSave: (payload: {
      moduleKey: string;
      fileName: string;
      sheetName: string;
      headers: string[];
      rows: string[][];
    }) => Promise<void> | void;
    isLoading?: boolean;
  }) => (
    <div>
      <h3>{title}</h3>
      <button type="button" onClick={() => onSave({
        moduleKey: 'product_feature_catalog',
        fileName: 'catalog.xlsx',
        sheetName: 'ChucNang',
        headers: ['STT nhóm', 'Tên nhóm/phân hệ', 'STT chức năng', 'Tên chức năng', 'Mô tả chi tiết', 'Trạng thái'],
        rows: [
          ['1', 'Khám bệnh', '1', 'Đăng ký khám', 'Tiếp nhận khám bệnh', 'Hoạt động'],
        ],
      })} disabled={Boolean(isLoading)}>
        Xác nhận import giả
      </button>
      <button type="button" onClick={onClose}>Đóng import giả</button>
    </div>
  ),
}));

const product: Product = {
  id: 1,
  service_group: 'GROUP_B',
  product_code: 'VNPT_HIS_L2',
  product_name: 'Phần mềm VNPT-HIS',
  package_name: 'HIS L2',
  domain_id: 1,
  vendor_id: 1,
  standard_price: 1000000,
  unit: 'Gói',
  description: 'Sản phẩm test',
  is_active: true,
};

const buildCatalog = (): ProductFeatureCatalog => ({
  product: {
    id: 1,
    uuid: 'product-1',
    service_group: 'GROUP_B',
    product_code: 'VNPT_HIS_L2',
    product_name: 'Phần mềm VNPT-HIS',
    package_name: 'HIS L2',
    description: 'Sản phẩm test',
    is_active: true,
    catalog_package_count: 2,
  },
  catalog_scope: {
    catalog_product_id: 1,
    product_ids: [1, 2],
    package_count: 2,
    product_codes: ['VNPT_HIS_L2', 'VNPT_HIS_L3'],
  },
  groups: [
    {
      id: 11,
      uuid: 'group-11',
      product_id: 1,
      group_name: 'Quản trị hệ thống',
      display_order: 1,
      notes: 'Nhóm nền tảng',
      created_at: '2026-03-25T09:00:00+07:00',
      created_by: 7,
      updated_at: '2026-03-25T09:00:00+07:00',
      updated_by: 7,
      created_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
      updated_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
      features: [
        {
          id: 21,
          uuid: 'feature-21',
          product_id: 1,
          group_id: 11,
          feature_name: 'Đăng nhập',
          detail_description: 'Cho phép đăng nhập',
          status: 'ACTIVE',
          display_order: 1,
          created_at: '2026-03-25T09:00:00+07:00',
          created_by: 7,
          updated_at: '2026-03-25T09:00:00+07:00',
          updated_by: 7,
          created_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
          updated_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
        },
      ],
    },
  ],
  audit_logs: [
    {
      id: 99,
      event: 'INSERT',
      auditable_type: 'product_feature_catalogs',
      auditable_id: 1,
      old_values: null,
      new_values: { groups: [{ group_name: 'Quản trị hệ thống' }] },
      created_at: '2026-03-25T09:00:00+07:00',
      created_by: 7,
      actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
    },
  ],
});

describe('ProductFeatureCatalogModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiSpies.fetchProductFeatureCatalog.mockResolvedValue(buildCatalog());
    apiSpies.updateProductFeatureCatalog.mockResolvedValue(buildCatalog());
  });

  it('loads the product feature catalog and saves edited feature rows', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();

    render(
      <ProductFeatureCatalogModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
        onNotify={onNotify}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Quản trị hệ thống')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Danh mục chức năng - Mã sản phẩm VNPT_HIS_L2 - Phần mềm VNPT-HIS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nhập file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất Excel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xuất PDF/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Mã sản phẩm VNPT_HIS_L2 - Phần mềm VNPT-HIS')).not.toBeInTheDocument();
    expect(screen.getByText(/Danh mục dùng chung cho 2 gói/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem lịch sử thay đổi/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Xem lịch sử thay đổi/i }));
    expect(screen.getByText(/Khởi tạo catalog/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu danh mục chức năng/i })).toBeDisabled();

    const featureNameInput = screen.getByDisplayValue('Đăng nhập');
    expect(featureNameInput).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Sửa chức năng/i }));
    expect(featureNameInput).not.toBeDisabled();
    await user.clear(featureNameInput);
    await user.type(featureNameInput, 'Đăng nhập HIS');
    expect(screen.getByRole('button', { name: /Lưu danh mục chức năng/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Lưu danh mục chức năng/i }));

    await waitFor(() => {
      expect(apiSpies.updateProductFeatureCatalog).toHaveBeenCalledTimes(1);
    });

    const [, payload] = apiSpies.updateProductFeatureCatalog.mock.calls[0];
    expect(payload.groups[0].group_name).toBe('Quản trị hệ thống');
    expect(payload.groups[0].features[0].feature_name).toBe('Đăng nhập HIS');
    expect(onNotify).toHaveBeenCalledWith(
      'success',
      'Danh mục chức năng',
      'Đã lưu danh mục chức năng của sản phẩm.'
    );
  });

  it('shows current feature list in the dedicated tab', async () => {
    const user = userEvent.setup();

    render(
      <ProductFeatureCatalogModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Quản trị hệ thống')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Danh sách chức năng/i }));

    expect(screen.getByText('Quản trị hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('Cho phép đăng nhập')).toBeInTheDocument();
    expect(screen.getAllByText('Hoạt động').length).toBeGreaterThan(0);
  });

  it('filters groups and feature names from the toolbar controls', async () => {
    const user = userEvent.setup();
    apiSpies.fetchProductFeatureCatalog.mockResolvedValue({
      ...buildCatalog(),
      groups: [
        ...buildCatalog().groups,
        {
          id: 12,
          uuid: 'group-12',
          product_id: 1,
          group_name: 'Hồ sơ bệnh án',
          display_order: 2,
          notes: 'Nhóm hồ sơ',
          created_at: '2026-03-25T09:00:00+07:00',
          created_by: 7,
          updated_at: '2026-03-25T09:00:00+07:00',
          updated_by: 7,
          created_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
          updated_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
          features: [
            {
              id: 22,
              uuid: 'feature-22',
              product_id: 1,
              group_id: 12,
              feature_name: 'Thiết lập hồ sơ',
              detail_description: 'Quản lý hồ sơ bệnh án',
              status: 'INACTIVE',
              display_order: 1,
              created_at: '2026-03-25T09:00:00+07:00',
              created_by: 7,
              updated_at: '2026-03-25T09:00:00+07:00',
              updated_by: 7,
              created_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
              updated_by_actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
            },
          ],
        },
      ],
    });

    render(
      <ProductFeatureCatalogModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Quản trị hệ thống')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Tất cả nhóm chức năng/i }));
    await user.click(await screen.findByText('Hồ sơ bệnh án'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hồ sơ bệnh án')).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue('Quản trị hệ thống')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Tìm kiếm tên chức năng theo nhóm...'), 'Thiết lập');

    expect(screen.getByDisplayValue('Thiết lập hồ sơ')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Đăng nhập')).not.toBeInTheDocument();
  });

  it('does not allow deleting a group while it still has child features', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();

    render(
      <ProductFeatureCatalogModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
        onNotify={onNotify}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Quản trị hệ thống')).toBeInTheDocument();
    });

    const deleteGroupButton = screen.getByRole('button', { name: /Xóa nhóm/i });
    expect(deleteGroupButton).toBeDisabled();
    await user.click(deleteGroupButton);

    expect(onNotify).not.toHaveBeenCalledWith(
      'success',
      expect.any(String),
      expect.any(String)
    );
    expect(screen.getByDisplayValue('Quản trị hệ thống')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Đăng nhập')).toBeInTheDocument();
  });

  it('opens review form after clicking import and only applies data after confirmation', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();

    render(
      <ProductFeatureCatalogModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
        onNotify={onNotify}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Quản trị hệ thống')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Nhập file/i }));

    expect(screen.getByRole('heading', { name: 'Nhập dữ liệu danh mục chức năng' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Khám bệnh')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Xác nhận import giả' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Khám bệnh')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Đăng ký khám')).toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledWith(
      'success',
      'Import danh mục chức năng',
      'Đã nạp 1 phân hệ từ file, vui lòng kiểm tra rồi bấm Lưu.'
    );
  });
});
