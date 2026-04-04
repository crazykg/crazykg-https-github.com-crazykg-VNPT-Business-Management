import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerFormModal, VendorFormModal } from '../components/modals';

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
    const customerCodeInput = screen.getByPlaceholderText('KH001');
    const customerNameInput = screen.getByPlaceholderText('Tên khách hàng');
    const customerCodeLabel = screen.getByText('Mã khách hàng');
    expect(customerCodeInput).toBeInTheDocument();
    expect(customerNameInput).toBeInTheDocument();
    expect(customerCodeLabel.className).toContain('text-xs');
    expect(customerCodeInput.className).toContain('h-8');
    expect(customerNameInput.className).toContain('h-8');
    const cancelButton = screen.getByRole('button', { name: 'Hủy' });
    const saveButton = screen.getByRole('button', { name: 'Lưu' });
    expect(cancelButton.className).toContain('h-11');
    expect(saveButton.className).toContain('h-11');
    expect(cancelButton.className).toContain('min-w-[128px]');
    expect(saveButton.className).toContain('min-w-[128px]');
    expect(screen.queryByText('Mã khách hàng, tên, mã số thuế và địa chỉ dùng làm dữ liệu gốc cho các module liên quan.')).not.toBeInTheDocument();
    expect(screen.queryByText('Nếu là khách hàng y tế, hệ thống sẽ yêu cầu chọn loại hình cơ sở để giữ dữ liệu phân tích đúng chuẩn.')).not.toBeInTheDocument();
    expect(screen.queryByText('Khách hàng là bệnh viện, trung tâm y tế, trạm y tế hoặc phòng khám.')).not.toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
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
