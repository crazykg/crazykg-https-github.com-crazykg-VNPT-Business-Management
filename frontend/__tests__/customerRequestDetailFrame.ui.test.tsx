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
        onTogglePinned={vi.fn()}
        onClose={vi.fn()}
      >
        <div>Chi tiết modal</div>
      </CustomerRequestDetailFrame>
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Chi tiết modal')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
