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

    expect(screen.getByText('Thông tin cơ bản')).toBeInTheDocument();
    expect(screen.getByText('Nhóm khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Để trống hệ thống tự sinh theo Tên khách hàng.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('KH001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tên khách hàng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('shows the auto-generated badge for existing system-generated customer codes', () => {
    render(
      <CustomerFormModal
        type="EDIT"
        data={{
          id: '1',
          uuid: 'customer-1',
          customer_code: 'TTYT_VI_THUY',
          customer_code_auto_generated: true,
          customer_name: 'Trung tâm Y tế Vị Thủy',
          tax_code: '',
          address: '',
          customer_sector: 'HEALTHCARE',
          healthcare_facility_type: 'MEDICAL_CENTER',
        }}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
      />
    );

    expect(screen.getByText('Tự sinh')).toBeInTheDocument();
  });
});
