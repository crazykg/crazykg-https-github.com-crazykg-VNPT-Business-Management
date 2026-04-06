import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ImportModal } from '../components/modals';

const { parseImportFileMock, pickImportSheetByModuleMock } = vi.hoisted(() => ({
  parseImportFileMock: vi.fn(),
  pickImportSheetByModuleMock: vi.fn(),
}));

vi.mock('../utils/importParser', () => ({
  parseImportFile: parseImportFileMock,
  pickImportSheetByModule: pickImportSheetByModuleMock,
}));

describe('ImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a selected file, shows a preview, and forwards the normalized payload', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    const parsedFile = {
      fileName: 'catalog.xlsx',
      sheets: [
        {
          name: 'Products',
          headers: ['Mã sản phẩm', 'Tên sản phẩm', 'Đơn giá chuẩn'],
          rows: [
            ['SP001', 'Sản phẩm A', '1200000'],
            ['', '', ''],
          ],
        },
      ],
    };

    parseImportFileMock.mockResolvedValue(parsedFile);
    pickImportSheetByModuleMock.mockReturnValue(parsedFile.sheets[0]);

    const { container } = render(
      <ImportModal
        title="Import sản phẩm"
        moduleKey="products"
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const file = new File(['fake-binary'], 'catalog.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await user.upload(input as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByText('catalog.xlsx')).toBeInTheDocument();
    });

    expect(screen.getByText(/Số dòng dữ liệu: 1/)).toBeInTheDocument();
    expect(screen.getByText('SP001')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm A')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu dữ liệu' }));

    expect(onSave).toHaveBeenCalledWith({
      moduleKey: 'products',
      fileName: 'catalog.xlsx',
      sheetName: 'Products',
      headers: ['Mã sản phẩm', 'Tên sản phẩm', 'Đơn giá chuẩn'],
      rows: [['SP001', 'Sản phẩm A', '1200000']],
      sheets: undefined,
    });
  });

  it('formats cus-personnel birthday preview as dd/mm/yyyy when the file contains an Excel serial date', async () => {
    const user = userEvent.setup();

    const parsedFile = {
      fileName: 'nhan-su-lien-he.xlsx',
      sheets: [
        {
          name: 'NhanSuLienHe',
          headers: ['Mã khách hàng', 'Họ và tên', 'Ngày sinh'],
          rows: [['93063', 'Trần Thị Thúy An', '33846']],
        },
      ],
    };

    parseImportFileMock.mockResolvedValue(parsedFile);
    pickImportSheetByModuleMock.mockReturnValue(parsedFile.sheets[0]);

    const { container } = render(
      <ImportModal
        title="Nhập nhân sự liên hệ"
        moduleKey="cus_personnel"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const file = new File(['fake-binary'], 'nhan-su-lien-he.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await user.upload(input as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByText('nhan-su-lien-he.xlsx')).toBeInTheDocument();
    });

    expect(screen.getByText('30/08/1992')).toBeInTheDocument();
    expect(screen.queryByText('33846')).not.toBeInTheDocument();
  });

  it('accepts import files larger than 5MB without blocking the upload', async () => {
    const user = userEvent.setup();

    const parsedFile = {
      fileName: 'catalog-large.xlsx',
      sheets: [
        {
          name: 'Products',
          headers: ['Mã sản phẩm', 'Tên sản phẩm'],
          rows: [['SP_BIG', 'Sản phẩm lớn']],
        },
      ],
    };

    parseImportFileMock.mockResolvedValue(parsedFile);
    pickImportSheetByModuleMock.mockReturnValue(parsedFile.sheets[0]);

    const { container } = render(
      <ImportModal
        title="Import sản phẩm"
        moduleKey="products"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const file = new File([new Uint8Array(6 * 1024 * 1024)], 'catalog-large.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await user.upload(input as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByText('catalog-large.xlsx')).toBeInTheDocument();
    });

    expect(parseImportFileMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/File vượt quá 5MB/)).not.toBeInTheDocument();
  });
});
