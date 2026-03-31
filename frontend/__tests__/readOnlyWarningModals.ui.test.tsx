import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CannotDeleteCustomerModal,
  CannotDeleteModal,
  CannotDeleteProductModal,
  ViewDepartmentModal,
} from '../components/Modals';

describe('Read-only and warning modals', () => {
  it('renders department detail modal through Modals re-export', () => {
    render(
      <ViewDepartmentModal
        data={{
          id: '2',
          dept_code: 'PKD',
          dept_name: 'Phòng Kinh doanh',
          parent_id: '1',
          is_active: true,
          employeeCount: 5,
          dept_path: 'BGDVT/PKD',
        }}
        departments={[
          { id: '1', dept_code: 'BGDVT', dept_name: 'Ban giám đốc', parent_id: null, dept_path: 'BGDVT', is_active: true },
          { id: '2', dept_code: 'PKD', dept_name: 'Phòng Kinh doanh', parent_id: '1', dept_path: 'BGDVT/PKD', is_active: true },
        ]}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Thông tin phòng ban')).toBeInTheDocument();
    expect(screen.getByText(/Phòng Kinh doanh/)).toBeInTheDocument();
    expect(screen.getByText(/BGDVT - Ban giám đốc/)).toBeInTheDocument();
  });

  it('renders department and entity blocker modals through Modals re-export', () => {
    const close = vi.fn();
    const { rerender } = render(
      <CannotDeleteModal
        data={{ id: '1', dept_name: 'Phòng Kế toán', dept_code: 'PKT', parent_id: null, dept_path: 'PKT', is_active: true, employeeCount: 3 }}
        onClose={close}
      />,
    );

    expect(screen.getByText('Không thể xóa phòng ban')).toBeInTheDocument();
    expect(screen.getByText(/Phòng Kế toán/)).toBeInTheDocument();

    rerender(
      <CannotDeleteProductModal
        data={{ id: '10', product_code: 'SP010', product_name: 'Phần mềm HIS', domain_id: '1', vendor_id: '2', standard_price: 1000000 }}
        onClose={close}
      />,
    );

    expect(screen.getByText('Không thể xóa sản phẩm')).toBeInTheDocument();
    expect(screen.getByText(/Phần mềm HIS/)).toBeInTheDocument();

    rerender(
      <CannotDeleteCustomerModal
        data={{ id: '20', uuid: 'customer-20', customer_name: 'Bệnh viện A', customer_code: 'KH020', tax_code: '0101234567', address: 'Hà Nội' }}
        onClose={close}
      />,
    );

    expect(screen.getByText('Không thể xóa khách hàng')).toBeInTheDocument();
    expect(screen.getByText(/Bệnh viện A/)).toBeInTheDocument();
  });
});
