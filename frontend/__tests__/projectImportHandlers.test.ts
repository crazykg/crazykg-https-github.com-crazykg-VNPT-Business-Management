import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductPackage, ProjectItemMaster } from '../types';
import { executeProjectItemsImport, executeProjectRaciImport } from '../components/modals/projectImportHandlers';
import type { ImportPayload } from '../components/modals/projectImportTypes';

describe('project import handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects non-Excel project item imports with a summary error', async () => {
    const onSetSummary = vi.fn();
    const onNotify = vi.fn();
    const onMergeCurrentItems = vi.fn();
    const onImportProjectItemsBatch = vi.fn();

    const task = executeProjectItemsImport({
      payload: {
        moduleKey: 'project_items',
        fileName: 'hang-muc.csv',
        sheetName: 'HangMuc',
        headers: [],
        rows: [],
      },
      currentProjectCode: 'DA001',
      mode: 'EDIT',
      onImportProjectItemsBatch,
      onMergeCurrentItems,
      onNotify,
      onSetSummary,
      parseNumber: (value) => Number(value) || 0,
      productLookupMap: new Map(),
    });

    await vi.runAllTimersAsync();
    await task;

    expect(onSetSummary).toHaveBeenCalledWith({
      success: 0,
      failed: 1,
      warnings: [],
      errors: ['File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).'],
    });
    expect(onNotify).toHaveBeenCalledWith(
      'error',
      'Nhập hạng mục dự án',
      'File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).'
    );
    expect(onImportProjectItemsBatch).not.toHaveBeenCalled();
    expect(onMergeCurrentItems).not.toHaveBeenCalled();
  });

  it('merges current-project item rows during add-mode imports', async () => {
    const onSetSummary = vi.fn();
    const onNotify = vi.fn();
    const onMergeCurrentItems = vi.fn();
    const onCloseModal = vi.fn();
    const product: ProductPackage = {
      id: 101,
      product_id: 11,
      package_code: 'SP001',
      package_name: 'San pham 1',
      product_name: 'San pham cha 1',
      standard_price: 1500000,
      unit: 'gói',
    } as ProductPackage;

    const payload: ImportPayload = {
      moduleKey: 'project_items',
      fileName: 'hang-muc.xlsx',
      sheetName: 'HangMuc',
      headers: [],
      rows: [],
      sheets: [
        {
          name: 'DuAn',
          headers: ['Mã DA', 'Tên dự án'],
          rows: [['DA001', 'Du an 1']],
        },
        {
          name: 'HangMuc',
          headers: ['Mã DA', 'Mã gói cước', 'Số lượng', 'Đơn giá'],
          rows: [['DA001', 'SP001', '2', '1500000']],
        },
      ],
    };

    const task = executeProjectItemsImport({
      payload,
      currentProjectCode: 'DA001',
      mode: 'ADD',
      onCloseModal,
      onMergeCurrentItems,
      onNotify,
      onSetSummary,
      parseNumber: (value) => Number(String(value).replace(/\./g, '').replace(',', '.')) || 0,
      productLookupMap: new Map([[ 'sp001', product ]]),
      now: () => 123456,
    });

    await vi.runAllTimersAsync();
    await task;

    expect(onMergeCurrentItems).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'ITEM_123456_2',
        productId: '11',
        productPackageId: '101',
        quantity: 2,
        unitPrice: 1500000,
        lineTotal: 3000000,
      }),
    ]);
    expect(onSetSummary).toHaveBeenCalledWith({
      success: 1,
      failed: 0,
      warnings: [],
      errors: [],
    });
    expect(onNotify).toHaveBeenCalledWith(
      'success',
      'Nhập hạng mục dự án',
      'Đã áp dụng 1 dòng hạng mục.'
    );
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });

  it('requires the MaHangMuc reference sheet for project RACI imports', async () => {
    const onSetSummary = vi.fn();
    const onNotify = vi.fn();
    const onMergeCurrentRaci = vi.fn();
    const projectItemLookupByCode = new Map<string, ProjectItemMaster[]>();

    const task = executeProjectRaciImport({
      payload: {
        moduleKey: 'project_raci',
        fileName: 'doi-ngu.xlsx',
        sheetName: 'RACI',
        headers: [],
        rows: [],
        sheets: [
          {
            name: 'RACI',
            headers: ['Mã hạng mục dự án', 'Mã nhân sự', 'Vai trò RACI'],
            rows: [['HM001', 'NV001', 'R']],
          },
        ],
      },
      currentProjectCode: 'DA001',
      employeeLookupMap: new Map(),
      mode: 'EDIT',
      onMergeCurrentRaci,
      onNotify,
      onSetSummary,
      projectItemLookupByCode,
    });

    await vi.runAllTimersAsync();
    await task;

    expect(onSetSummary).toHaveBeenCalledWith({
      success: 0,
      failed: 1,
      warnings: [],
      errors: ['Thiếu sheet tham chiếu "MaHangMuc". Vui lòng dùng đúng file mẫu đội ngũ dự án.'],
    });
    expect(onNotify).toHaveBeenCalledWith(
      'error',
      'Nhập đội ngũ dự án',
      'Thiếu sheet tham chiếu "MaHangMuc". Vui lòng dùng đúng file mẫu đội ngũ dự án.'
    );
    expect(onMergeCurrentRaci).not.toHaveBeenCalled();
  });
});
