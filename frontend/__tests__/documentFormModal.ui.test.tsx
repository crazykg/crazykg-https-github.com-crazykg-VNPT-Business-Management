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

    render(
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
    expect(screen.queryByText('Loại tài liệu')).not.toBeInTheDocument();
    expect(screen.getByText('Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    expect(screen.getByText('Số văn bản là bắt buộc')).toBeInTheDocument();
    expect(screen.getByText('Tên/Trích yếu văn bản là bắt buộc')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
