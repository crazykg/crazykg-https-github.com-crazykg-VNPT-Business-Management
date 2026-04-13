import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Business, Product } from '../types';
import { BusinessList } from '../components/BusinessList';

const businesses: Business[] = [
  {
    id: 'business-2',
    uuid: 'business-2',
    domain_code: 'KD002',
    domain_name: 'Lĩnh vực chuyển đổi số cho bệnh viện tuyến tỉnh với tên rất dài để kiểm tra wrap desktop và mobile',
    focal_point_name: 'Nguyễn Văn Điều phối rất dài để kiểm tra hiển thị xuống dòng trong cột đầu mối chuyên quản',
    focal_point_phone: '0909123456',
    focal_point_email: 'dau-moi-rat-dai@vnpt.vn',
    created_at: '2026-03-20',
  },
  {
    id: 'business-1',
    uuid: 'business-1',
    domain_code: 'KD001',
    domain_name: 'Giáo dục số',
    focal_point_name: 'Trần Minh Anh',
    focal_point_phone: '0909555666',
    focal_point_email: 'tmanh@vnpt.vn',
    created_at: '2026-03-18',
  },
];

const products: Product[] = [
  {
    id: 'product-1',
    service_group: 'GROUP_A',
    product_code: 'SP001',
    product_name: 'Nền tảng HIS',
    package_name: 'Gói HIS',
    domain_id: 'business-2',
    vendor_id: 'vendor-1',
    standard_price: 1000000,
    unit: 'Gói',
    is_active: true,
  },
  {
    id: 'product-2',
    service_group: 'GROUP_A',
    product_code: 'SP002',
    product_name: 'Cổng giáo dục',
    package_name: 'Gói giáo dục',
    domain_id: 'business-1',
    vendor_id: 'vendor-1',
    standard_price: 2000000,
    unit: 'Gói',
    is_active: true,
  },
];

describe('Business revenue-style list', () => {
  it('keeps the business screen on the shared revenue-style layout with responsive sorting', async () => {
    const user = userEvent.setup();

    render(
      <BusinessList
        businesses={businesses}
        products={products}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Lĩnh vực kinh doanh' }).closest('section')).toHaveClass('rounded-b-lg', 'border-t-0');
    expect(screen.queryByText('Quản lý danh mục lĩnh vực kinh doanh theo cùng nhịp giao diện Quản trị Doanh thu.')).not.toBeInTheDocument();
    expect(screen.queryByText(/kết quả/)).not.toBeInTheDocument();

    const desktopTable = screen.getByTestId('business-desktop-table');
    expect(desktopTable).toHaveClass('table-fixed');

    const longBusinessName = 'Lĩnh vực chuyển đổi số cho bệnh viện tuyến tỉnh với tên rất dài để kiểm tra wrap desktop và mobile';
    const businessNameCell = within(desktopTable).getByText(longBusinessName);
    expect(businessNameCell).toHaveClass('whitespace-normal', 'break-words', 'leading-5');
    expect(businessNameCell.closest('td')).toHaveClass('align-middle');

    const longFocalPoint = 'Nguyễn Văn Điều phối rất dài để kiểm tra hiển thị xuống dòng trong cột đầu mối chuyên quản';
    const focalPointCell = within(desktopTable).getByText(longFocalPoint);
    expect(focalPointCell).toHaveClass('leading-5');
    expect(focalPointCell.closest('td')).toHaveClass('align-middle');

    const responsiveList = screen.getByTestId('business-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách lĩnh vực');
    await user.selectOptions(sortSelect, 'domain_code:asc');
    expect(sortSelect).toHaveValue('domain_code:asc');

    const cards = Array.from(responsiveList.querySelectorAll('article'));
    expect(cards[0]).toHaveTextContent('Giáo dục số');
    expect(cards[1]).toHaveTextContent(longBusinessName);
  });
});
