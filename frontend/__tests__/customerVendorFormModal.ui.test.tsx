import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerFormModal, VendorFormModal } from '../components/Modals';

describe('Customer/Vendor form modals revenue-style', () => {
  it('renders the vendor modal with revenue-style helper section and footer actions', () => {
    render(
      <VendorFormModal
        type="ADD"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Thông tin đối tác / nhà cung cấp')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('DT001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tên đối tác')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('renders the customer modal with grouped sections and healthcare options', () => {
    render(
      <CustomerFormModal
        type="ADD"
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
      />
    );

    expect(screen.getByText('Thông tin khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Thông tin cơ bản')).toBeInTheDocument();
    expect(screen.getByText('Nhóm khách hàng')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('KH001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tên khách hàng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});
