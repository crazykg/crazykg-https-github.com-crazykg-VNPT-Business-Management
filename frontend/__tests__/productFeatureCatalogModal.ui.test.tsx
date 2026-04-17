import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductFeatureCatalog, ProductFeatureCatalogListPage } from '../types/product';
import { ProductFeatureCatalogModal } from '../components/ProductFeatureCatalogModal';

const apiSpies = vi.hoisted(() => ({
  fetchProductFeatureCatalog: vi.fn(),
  fetchProductFeatureCatalogList: vi.fn(),
  updateProductFeatureCatalog: vi.fn(),
}));

const excelSpies = vi.hoisted(() => ({
  downloadExcelWorkbook: vi.fn(),
}));

const importModalState = vi.hoisted(() => ({
  payload: {
    moduleKey: 'product_feature_catalog',
    fileName: 'catalog.xlsx',
    sheetName: 'ChucNang',
    headers: ['STT nhóm', 'Tên nhóm/phân hệ', 'STT chức năng', 'Tên chức năng', 'Mô tả chi tiết', 'Trạng thái'],
    rows: [
      ['1', 'Khám bệnh', '1', 'Đăng ký khám', 'Tiếp nhận khám bệnh', 'Hoạt động'],
    ],
  },
}));

vi.mock('../services/api/productApi', () => ({
  fetchProductFeatureCatalog: apiSpies.fetchProductFeatureCatalog,
  fetchProductFeatureCatalogList: apiSpies.fetchProductFeatureCatalogList,
  updateProductFeatureCatalog: apiSpies.updateProductFeatureCatalog,
}));

vi.mock('../utils/excelTemplate', () => ({
  downloadExcelWorkbook: excelSpies.downloadExcelWorkbook,
}));

vi.mock('../utils/exportUtils', () => ({
  exportPdfTable: vi.fn(() => true),
  isoDateStamp: vi.fn(() => '2026-03-25'),
}));

vi.mock('../utils/importParser', () => ({
  parseImportFile: vi.fn(),
}));

vi.mock('../components/modals', () => ({
  ModalWrapper: ({
    children,
    title,
    headerAside,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
    headerAside?: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {headerAside}
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
      <button type="button" onClick={() => onSave(importModalState.payload)} disabled={Boolean(isLoading)}>
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
      new_values: {
        groups: [{ group_name: 'Quản trị hệ thống' }],
        audit_context: { source: 'FORM' },
        change_summary: {
          source: 'FORM',
          counts: {
            groups_created: 1,
            groups_updated: 0,
            groups_deleted: 0,
            features_created: 1,
            features_updated: 0,
            features_deleted: 0,
          },
          entries: [
            {
              entity_type: 'group',
              action: 'CREATE',
              message: 'Tạo phân hệ "Quản trị hệ thống".',
            },
            {
              entity_type: 'feature',
              action: 'CREATE',
              message: 'Tạo chức năng "Đăng nhập" trong phân hệ "Quản trị hệ thống".',
            },
          ],
        },
      },
      created_at: '2026-03-25T09:00:00+07:00',
      created_by: 7,
      actor: { id: 7, full_name: 'Nguyen Van A', username: 'tester' },
    },
  ],
});

const buildListPage = (catalog: ProductFeatureCatalog = buildCatalog(), overrides: Partial<ProductFeatureCatalogListPage> = {}): ProductFeatureCatalogListPage => ({
  product: catalog.product,
  catalog_scope: catalog.catalog_scope,
  group_filters: (catalog.groups || []).map((group) => ({
    id: group.id,
    group_name: group.group_name,
    display_order: group.display_order,
    notes: group.notes ?? '',
  })),
  rows: (catalog.groups || []).flatMap((group, groupIndex) => ([
    {
      row_type: 'group',
      group_id: group.id,
      feature_id: null,
      group_display_order: group.display_order || groupIndex + 1,
      feature_display_order: null,
      name: group.group_name,
      detail: group.notes || 'Danh sách chức năng thuộc phân hệ này.',
    },
    ...(group.features || []).map((feature, featureIndex) => ({
      row_type: 'feature' as const,
      group_id: group.id,
      feature_id: feature.id,
      group_display_order: group.display_order || groupIndex + 1,
      feature_display_order: feature.display_order || featureIndex + 1,
      name: feature.feature_name,
      detail: feature.detail_description || '—',
    })),
  ])),
  meta: {
    page: 1,
    per_page: 100,
    total: (catalog.groups || []).reduce((total, group) => total + 1 + (group.features || []).length, 0),
    total_pages: 1,
  },
  ...overrides,
});

describe('ProductFeatureCatalogModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importModalState.payload = {
      moduleKey: 'product_feature_catalog',
      fileName: 'catalog.xlsx',
      sheetName: 'ChucNang',
      headers: ['STT nhóm', 'Tên nhóm/phân hệ', 'STT chức năng', 'Tên chức năng', 'Mô tả chi tiết', 'Trạng thái'],
      rows: [
        ['1', 'Khám bệnh', '1', 'Đăng ký khám', 'Tiếp nhận khám bệnh', 'Hoạt động'],
      ],
    };
    apiSpies.fetchProductFeatureCatalog.mockResolvedValue(buildCatalog());
    apiSpies.fetchProductFeatureCatalogList.mockResolvedValue(buildListPage());
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

    expect(screen.getByText(/^I$/)).toBeInTheDocument();
    expect(screen.queryByText('1.1')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Danh mục chức năng: VNPT_HIS_L2 - Phần mềm VNPT-HIS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Nhập$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất Excel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xuất PDF/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Dịch vụ nhóm B')).not.toBeInTheDocument();
    expect(screen.queryByText('Sản phẩm hoạt động')).not.toBeInTheDocument();
    expect(screen.queryByText(/Danh mục dùng chung cho 2 gói/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem lịch sử thay đổi/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Xem lịch sử thay đổi/i }));
    expect(screen.getByText(/Khởi tạo catalog/i)).toBeInTheDocument();
    expect(screen.getByText('Tạo phân hệ "Quản trị hệ thống".')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu danh mục chức năng/i })).toBeDisabled();

    const featureNameInput = screen.getByDisplayValue('Đăng nhập');
    expect(featureNameInput).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Sửa chức năng/i }));
    expect(screen.getByRole('heading', { name: 'Chỉnh sửa chức năng: Đăng nhập' })).toBeInTheDocument();

    const modalFeatureNameInput = screen.getAllByDisplayValue('Đăng nhập').find((element) => !element.hasAttribute('disabled'));
    expect(modalFeatureNameInput).toBeTruthy();
    await user.clear(modalFeatureNameInput!);
    await user.type(modalFeatureNameInput!, 'Đăng nhập HIS');
    await user.click(screen.getByRole('button', { name: /Cập nhật thông tin/i }));

    expect(screen.getByDisplayValue('Đăng nhập HIS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu danh mục chức năng/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Lưu danh mục chức năng/i }));

    await waitFor(() => {
      expect(apiSpies.updateProductFeatureCatalog).toHaveBeenCalledTimes(1);
    });

    const [, payload] = apiSpies.updateProductFeatureCatalog.mock.calls[0];
    expect(payload.groups[0].group_name).toBe('Quản trị hệ thống');
    expect(payload.groups[0].features[0].feature_name).toBe('Đăng nhập HIS');
    expect(payload.audit_context).toEqual({ source: 'FORM' });
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

    expect(screen.getByTestId('catalog-tab-switcher')).toHaveClass('grid', 'grid-cols-2', 'sm:flex');
    expect(screen.getByRole('button', { name: /Cập nhật danh mục/i })).toHaveClass('min-w-0', 'justify-center');
    await user.click(screen.getByRole('button', { name: /Danh sách chức năng/i }));

    expect(screen.getByRole('columnheader', { name: 'STT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên phân hệ/chức năng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mô tả chi tiết tính năng' })).toBeInTheDocument();
    expect(screen.getByTestId('feature-list-table')).toHaveClass('table-fixed', 'lg:min-w-[1080px]');
    expect(screen.getByTestId('feature-list-table')).not.toHaveClass('min-w-[1080px]');
    expect(screen.getByText('Đăng nhập').closest('td')).toHaveClass('break-words');
    expect(screen.getByText('Cho phép đăng nhập').closest('td')).toHaveClass('break-words');
    expect(screen.getByText('Quản trị hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('Cho phép đăng nhập')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument();
  });

  it('hides the editor tab on tablet/mobile and defaults to the list tab', async () => {
    const originalInnerWidth = window.innerWidth;
    const originalOuterWidth = window.outerWidth;

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 });
    Object.defineProperty(window, 'outerWidth', { configurable: true, value: 768 });
    window.dispatchEvent(new Event('resize'));

    try {
      render(
        <ProductFeatureCatalogModal
          product={product}
          canManage={true}
          onClose={vi.fn()}
          onNotify={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'STT' })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Cập nhật danh mục/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('catalog-tab-switcher')).toHaveClass('justify-center');
      expect(screen.getByRole('button', { name: /Danh sách chức năng/i })).toHaveClass('w-full');
      expect(apiSpies.fetchProductFeatureCatalog).not.toHaveBeenCalled();
      expect(apiSpies.fetchProductFeatureCatalogList).toHaveBeenCalledWith(1, {
        page: 1,
        per_page: 100,
        group_id: null,
        search: null,
      });
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
      Object.defineProperty(window, 'outerWidth', { configurable: true, value: originalOuterWidth });
      window.dispatchEvent(new Event('resize'));
    }
  });

  it('loads additional list rows when scrolling near the bottom of the list tab', async () => {
    const user = userEvent.setup();
    const baseCatalog = buildCatalog();
    const secondGroup = {
      ...baseCatalog.groups[0],
      id: 12,
      uuid: 'group-12',
      group_name: 'Khám bệnh',
      display_order: 2,
      features: [
        {
          ...baseCatalog.groups[0].features[0],
          id: 22,
          uuid: 'feature-22',
          feature_name: 'Thiết lập khoa/phòng',
          detail_description: 'Thiết lập phạm vi khoa phòng',
          display_order: 1,
        },
      ],
    };

    apiSpies.fetchProductFeatureCatalogList
      .mockResolvedValueOnce(buildListPage(baseCatalog, {
        rows: buildListPage(baseCatalog).rows.slice(0, 2),
        meta: { page: 1, per_page: 2, total: 4, total_pages: 2 },
      }))
      .mockResolvedValueOnce(buildListPage({
        ...baseCatalog,
        groups: [baseCatalog.groups[0], secondGroup],
      }, {
        rows: buildListPage({
          ...baseCatalog,
          groups: [baseCatalog.groups[0], secondGroup],
        }).rows.slice(2, 4),
        meta: { page: 2, per_page: 2, total: 4, total_pages: 2 },
      }));

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

    await waitFor(() => {
      expect(apiSpies.fetchProductFeatureCatalogList).toHaveBeenCalledWith(1, {
        page: 1,
        per_page: 100,
        group_id: null,
        search: null,
      });
    });

    const scrollContainer = await screen.findByTestId('feature-list-scroll');
    Object.defineProperty(scrollContainer, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 820 });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(apiSpies.fetchProductFeatureCatalogList).toHaveBeenCalledWith(1, {
        page: 2,
        per_page: 100,
        group_id: null,
        search: null,
      });
    });

    expect(screen.getByText(/Đang hiển thị 2 \/ 4 chức năng — bấm "Tải thêm" để tiếp tục/i)).toBeInTheDocument();
    expect(await screen.findByText('Khám bệnh')).toBeInTheDocument();
    expect(screen.getByText('Thiết lập khoa/phòng')).toBeInTheDocument();
  });

  it('exports the list view as a document-style workbook', async () => {
    const user = userEvent.setup();
    const baseCatalog = buildCatalog();
    apiSpies.fetchProductFeatureCatalog.mockResolvedValue({
      ...baseCatalog,
      groups: [
        {
          ...baseCatalog.groups[0],
          features: [
            {
              ...baseCatalog.groups[0].features[0],
              detail_description: 'Chức năng gồm các tính năng:-Không có space -Nhập OTP',
            },
            {
              ...baseCatalog.groups[0].features[0],
              id: 22,
              uuid: 'feature-22',
              feature_name: 'Trang chủ',
              display_order: 2,
              detail_description:
                'Chức năng gồm các tính năng: •Hiển thị thông tin trang chủ •Kiểm tra các thông tin thông báo trên trang chủ',
            },
            {
              ...baseCatalog.groups[0].features[0],
              id: 23,
              uuid: 'feature-23',
              feature_name: 'Đăng xuất',
              display_order: 3,
              detail_description: 'Chức năng gồm các tính năng: 1.Mục một 2)Mục hai',
            },
            {
              ...baseCatalog.groups[0].features[0],
              id: 24,
              uuid: 'feature-24',
              feature_name: 'Quản lý người dùng',
              display_order: 4,
              detail_description: 'Chức năng gồm các tính năng: –Phân quyền tài khoản —Phân quyền dữ liệu',
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

    await user.click(screen.getByRole('button', { name: /Xuất Excel/i }));

    expect(excelSpies.downloadExcelWorkbook).toHaveBeenCalledTimes(1);
    const [fileName, sheets] = excelSpies.downloadExcelWorkbook.mock.calls[0];
    expect(fileName).toBe('danh_muc_chuc_nang_VNPT_HIS_L2_2026-03-25');
    expect(sheets[0].name).toBe('DanhMucChucNang');
    expect(sheets[0].headers).toEqual(['STT', 'Tên phân hệ/chức năng', 'Mô tả chi tiết tính năng']);
    expect(sheets[0].columns).toEqual([52, 420, 860]);
    expect(sheets[0].styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'CatalogHeader', fontName: 'Times New Roman', fontSize: 13 }),
        expect.objectContaining({ id: 'CatalogFeatureDetail', fontName: 'Times New Roman', fontSize: 13 }),
      ])
    );
    expect(sheets[0].rows).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({ value: 'I', styleId: 'CatalogSttGroup' }),
          expect.objectContaining({ value: 'Quản trị hệ thống', styleId: 'CatalogGroupName' }),
          expect.objectContaining({ value: '', styleId: 'CatalogGroupDetail' }),
        ],
        [
          expect.objectContaining({ value: 1, styleId: 'CatalogSttFeature' }),
          expect.objectContaining({ value: 'Đăng nhập', styleId: 'CatalogFeatureName' }),
          expect.objectContaining({
            value: 'Chức năng gồm các tính năng:\n\u00A0- Không có space\n\u00A0- Nhập OTP',
            styleId: 'CatalogFeatureDetail',
          }),
        ],
        [
          expect.objectContaining({ value: 2, styleId: 'CatalogSttFeature' }),
          expect.objectContaining({ value: 'Trang chủ', styleId: 'CatalogFeatureName' }),
          expect.objectContaining({
            value:
              'Chức năng gồm các tính năng:\n\u00A0• Hiển thị thông tin trang chủ\n\u00A0• Kiểm tra các thông tin thông báo trên trang chủ',
            styleId: 'CatalogFeatureDetail',
          }),
        ],
        [
          expect.objectContaining({ value: 3, styleId: 'CatalogSttFeature' }),
          expect.objectContaining({ value: 'Đăng xuất', styleId: 'CatalogFeatureName' }),
          expect.objectContaining({
            value: 'Chức năng gồm các tính năng:\n\u00A01. Mục một\n\u00A02) Mục hai',
            styleId: 'CatalogFeatureDetail',
          }),
        ],
        [
          expect.objectContaining({ value: 4, styleId: 'CatalogSttFeature' }),
          expect.objectContaining({ value: 'Quản lý người dùng', styleId: 'CatalogFeatureName' }),
          expect.objectContaining({
            value: 'Chức năng gồm các tính năng:\n\u00A0– Phân quyền tài khoản\n\u00A0— Phân quyền dữ liệu',
            styleId: 'CatalogFeatureDetail',
          }),
        ],
      ])
    );
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

  it('does not allow deleting a persisted empty group because data has already been generated', async () => {
    apiSpies.fetchProductFeatureCatalog.mockResolvedValue({
      ...buildCatalog(),
      groups: [
        {
          ...buildCatalog().groups[0],
          features: [],
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

    const deleteGroupButton = screen.getByRole('button', { name: /Xóa nhóm/i });
    expect(deleteGroupButton).toBeDisabled();
    expect(deleteGroupButton).toHaveAttribute('title', 'Dữ liệu đã phát sinh. Không thể xóa nhóm đã lưu.');
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

    await user.click(screen.getByRole('button', { name: /^Nhập$/i }));
    await user.click(screen.getByRole('menuitem', { name: /Nhập dữ liệu/i }));

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

  it('accepts the compact 3-column catalog sheet exported from the modal', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();

    importModalState.payload = {
      moduleKey: 'product_feature_catalog',
      fileName: 'catalog-export.xls',
      sheetName: 'DanhMucChucNang',
      headers: ['STT', 'Tên phân hệ/chức năng', 'Mô tả chi tiết tính năng'],
      rows: [
        ['I', 'Quản trị hệ thống', ''],
        ['1', 'Đăng nhập', 'Cho phép người dùng đăng nhập'],
        ['2', 'Trang chủ', 'Hiển thị thông báo tổng hợp'],
      ],
    };

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

    await user.click(screen.getByRole('button', { name: /^Nhập$/i }));
    await user.click(screen.getByRole('menuitem', { name: /Nhập dữ liệu/i }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận import giả' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Đăng nhập')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Trang chủ')).toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledWith(
      'success',
      'Import danh mục chức năng',
      'Đã nạp 1 phân hệ từ file, vui lòng kiểm tra rồi bấm Lưu.'
    );
  });

  it('shows only toast when import fails without rendering duplicated inline error', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();

    importModalState.payload = {
      moduleKey: 'product_feature_catalog',
      fileName: 'catalog-invalid.xls',
      sheetName: 'DanhMucChucNang',
      headers: ['STT', 'Tên chức năng', 'Mô tả chi tiết'],
      rows: [
        ['1', 'Đăng nhập', 'Cho phép người dùng đăng nhập'],
      ],
    };

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

    await user.click(screen.getByRole('button', { name: /^Nhập$/i }));
    await user.click(screen.getByRole('menuitem', { name: /Nhập dữ liệu/i }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận import giả' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'error',
        'Import thất bại',
        'File import chưa có cột "Tên nhóm/phân hệ".'
      );
    });

    expect(screen.queryByText('File import chưa có cột "Tên nhóm/phân hệ".')).not.toBeInTheDocument();
  });

  it('preserves persisted group and feature ids when importing matching catalog rows before save', async () => {
    const user = userEvent.setup();

    importModalState.payload = {
      moduleKey: 'product_feature_catalog',
      fileName: 'catalog.xlsx',
      sheetName: 'ChucNang',
      headers: ['STT nhóm', 'Tên nhóm/phân hệ', 'STT chức năng', 'Tên chức năng', 'Mô tả chi tiết', 'Trạng thái'],
      rows: [
        ['1', 'Quản trị hệ thống', '1', 'Đăng nhập HIS', 'Cho phép đăng nhập HIS', 'Hoạt động'],
      ],
    };

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

    await user.click(screen.getByRole('button', { name: /^Nhập$/i }));
    await user.click(screen.getByRole('menuitem', { name: /Nhập dữ liệu/i }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận import giả' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Quản trị hệ thống')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Đăng nhập HIS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Lưu danh mục chức năng/i }));

    await waitFor(() => {
      expect(apiSpies.updateProductFeatureCatalog).toHaveBeenCalledTimes(1);
    });

    const [, payload] = apiSpies.updateProductFeatureCatalog.mock.calls[0];
    expect(payload.groups[0].id).toBe(11);
    expect(payload.groups[0].features[0].id).toBe(21);
    expect(payload.groups[0].features[0].feature_name).toBe('Đăng nhập HIS');
    expect(payload.audit_context).toEqual({
      source: 'IMPORT',
      import_file_name: 'catalog.xlsx',
      import_sheet_name: 'ChucNang',
      import_row_count: 1,
      import_group_count: 1,
      import_feature_count: 1,
    });
  });
});
