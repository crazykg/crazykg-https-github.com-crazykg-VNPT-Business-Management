import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentFormModal } from '../components/modals';
import type { Product } from '../types';

const product: Product = {
  id: 'product-1',
  product_code: 'SP001',
  product_name: 'HIS Premium',
} as Product;

describe('DocumentFormModal', () => {
  it('uses product upload rules and labels when rendering through Modals re-export', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    const { container } = render(
      <DocumentFormModal
        type="ADD"
        customers={[]}
        projects={[]}
        products={[product]}
        preselectedProduct={product}
        mode="product_upload"
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Upload tài liệu sản phẩm')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('123/QĐ-VNPT')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập tên/trích yếu văn bản')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập nội dung chính sách hoa hồng...')).toBeInTheDocument();
    expect(screen.queryByText('Loại tài liệu')).not.toBeInTheDocument();
    expect(screen.getByText('Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải file/i })).toHaveClass('whitespace-nowrap', 'min-w-[116px]');
    expect(container.querySelector('input[type="date"]')).toHaveClass('h-[46px]', 'rounded-lg');
    expect(screen.getByText('Số văn bản').closest('label')).toHaveClass('text-sm');
    expect(screen.getByText('Ngày ban hành').closest('label')).toHaveClass('text-sm');

    await user.click(screen.getAllByText('SP001 - HIS Premium')[0]);

    expect(screen.getByPlaceholderText('Tìm kiếm...')).toBeInTheDocument();
    expect(screen.getAllByText('SP001 - HIS Premium').length).toBeGreaterThan(1);
    expect(container.querySelector('input[placeholder="Tìm kiếm..."]')).toBeNull();

    await user.type(screen.getByPlaceholderText('123/QĐ-VNPT'), '123/QĐ-VNPT');
    await user.type(screen.getByPlaceholderText('Nhập tên/trích yếu văn bản'), 'Chính sách giá tháng 4');
    await user.type(screen.getByPlaceholderText('Nhập nội dung chính sách hoa hồng...'), 'Hoa hồng 10% cho cộng tác viên');

    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: '123/QĐ-VNPT',
      name: 'Chính sách giá tháng 4',
      commissionPolicyText: 'Hoa hồng 10% cho cộng tác viên',
      scope: 'PRODUCT_PRICING',
    }));
  });

  it('disables the footer actions and shows saving state while save is pending', () => {
    render(
      <DocumentFormModal
        type="ADD"
        customers={[]}
        projects={[]}
        products={[product]}
        preselectedProduct={product}
        mode="product_upload"
        isSaving
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Đang lưu/ })).toBeDisabled();
  });
});
