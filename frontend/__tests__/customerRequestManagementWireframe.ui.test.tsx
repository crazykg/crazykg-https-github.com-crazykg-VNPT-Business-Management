import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomerRequestManagementWireframe } from '../components/customer-request/CustomerRequestManagementWireframe';

describe('CustomerRequestManagementWireframe UI', () => {
  it('renders both wireframe canvases without helper views', () => {
    render(<CustomerRequestManagementWireframe />);

    expect(screen.getByText(/Wireframe giao diện tab Tổng quan \+ Bảng theo dõi/i)).toBeInTheDocument();
    expect(screen.getByText('Tab Tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Tab Bảng theo dõi')).toBeInTheDocument();
    expect(screen.getByText('Ca nóng:')).toBeInTheDocument();
    expect(screen.getByText('Thiếu ước lượng:')).toBeInTheDocument();
    expect(screen.getByText('Sắp quá SLA:')).toBeInTheDocument();
    expect(screen.getByText('Đang chờ PM:')).toBeInTheDocument();
    expect(screen.getByText('01/01/2026')).toBeInTheDocument();
    expect(screen.getByText('30/04/2026')).toBeInTheDocument();
    expect(screen.getByText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();
    expect(screen.getByText('Tất cả')).toBeInTheDocument();
    expect(screen.getByText('Bộ lọc')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tổng công ty ABC' })).toHaveAttribute('href', '/customer-request-management');
    expect(screen.getByRole('link', { name: 'Dự án CRM doanh nghiệp' })).toHaveAttribute('href', '/customer-request-management');
    expect(screen.getByText('CRC-202604-0188 | Điều chỉnh yêu cầu tích hợp hợp đồng')).toBeInTheDocument();
    expect(screen.queryByText('Trung tâm điều hành yêu cầu khách hàng')).not.toBeInTheDocument();
    expect(screen.queryByText('Nhập dữ liệu tạm')).not.toBeInTheDocument();
    expect(screen.queryByText('Xuất báo cáo nhanh')).not.toBeInTheDocument();
    expect(screen.queryByText('Chế độ xem')).not.toBeInTheDocument();
    expect(screen.queryByText('Mục tiêu')).not.toBeInTheDocument();
    expect(screen.queryByText('Kiểu đọc')).not.toBeInTheDocument();
    expect(screen.queryByText('Phạm vi')).not.toBeInTheDocument();
    expect(screen.queryByText('Khung 01')).not.toBeInTheDocument();
    expect(screen.queryByText('Khung 02')).not.toBeInTheDocument();
    expect(screen.queryByText('Checklist phân tích')).not.toBeInTheDocument();
    expect(screen.queryByText('Nguyên tắc density')).not.toBeInTheDocument();
    expect(screen.queryByText('Câu hỏi cần chốt')).not.toBeInTheDocument();
  });
});
