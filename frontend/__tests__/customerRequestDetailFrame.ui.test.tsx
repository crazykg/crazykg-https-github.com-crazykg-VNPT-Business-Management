import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestDetailFrame } from '../components/customer-request/CustomerRequestDetailFrame';

describe('CustomerRequestDetailFrame UI', () => {
  it('renders modal mode through a portal and locks page scroll', () => {
    const { container, unmount } = render(
      <CustomerRequestDetailFrame
        mode="modal"
        request={{
          id: 1,
          ma_yc: 'CRC-202603-0001',
          request_code: 'CRC-202603-0001',
          tieu_de: 'Điều chỉnh chức năng',
          summary: 'Điều chỉnh chức năng',
          customer_name: 'Bệnh viện Sản',
          khach_hang_name: 'Bệnh viện Sản',
          do_uu_tien: 2,
          trang_thai: 'assigned_to_dispatcher',
          ket_qua: 'dang_xu_ly',
          current_status_name_vi: 'Đang xử lý',
        }}
        isPinned={false}
        title="Cập nhật yêu cầu"
        subtitle="Điều chỉnh chức năng"
        icon="edit_note"
        footer={<div>Cập nhật yêu cầu</div>}
        onTogglePinned={vi.fn()}
        onClose={vi.fn()}
      >
        <div>Chi tiết modal</div>
      </CustomerRequestDetailFrame>
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain('h-[90dvh]');
    expect(dialog.className).toContain('max-w-none');
    expect(dialog.className).toContain('rounded-[var(--ui-modal-mobile-radius)]');
    expect(dialog.className).toContain('sm:rounded-[var(--ui-modal-radius)]');
    expect(dialog.className).not.toContain('sm:h-[calc(100dvh-48px)]');
    expect(dialog.className).not.toContain('sm:rounded-xl');
    expect(dialog.className).not.toContain('lg:max-w-[1120px]');
    expect(dialog.className).not.toContain('xl:max-w-[1240px]');
    expect(dialog.className).not.toContain('2xl:max-w-[1280px]');
    expect(screen.getByText('Chi tiết modal')).toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0001')).toBeInTheDocument();
    expect(screen.getAllByText('Cập nhật yêu cầu')).toHaveLength(2);
    expect(screen.getAllByText('Điều chỉnh chức năng')[0]).toBeInTheDocument();
    expect(screen.queryByText('Đang xử lý')).not.toBeInTheDocument();
    expect(screen.queryByText('Bệnh viện Sản')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Đóng')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
