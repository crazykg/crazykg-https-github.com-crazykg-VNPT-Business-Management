import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFormModal } from '../components/modals';
import { ProjectList } from '../components/ProjectList';
import type { Customer, Department, ProcedureTemplate, Project } from '../types';

const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());
const fetchProjectImplementationUnitOptionsMock = vi.hoisted(() => vi.fn());
const fetchProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const generateProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const syncProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());

fetchProcedureTemplatesMock.mockResolvedValue([
  {
    id: 1,
    template_code: 'DAU_TU',
    template_name: 'Đầu tư',
    is_active: true,
    phases: ['CHUAN_BI', 'THUC_HIEN_DAU_TU'],
  },
] as ProcedureTemplate[]);

fetchProjectImplementationUnitOptionsMock.mockResolvedValue([]);
fetchProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });
generateProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });
syncProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });

vi.mock('../services/v5Api', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
  fetchProjectRevenueSchedules: fetchProjectRevenueSchedulesMock,
  generateProjectRevenueSchedules: generateProjectRevenueSchedulesMock,
  syncProjectRevenueSchedules: syncProjectRevenueSchedulesMock,
  deleteUploadedDocumentAttachment: vi.fn(),
  uploadDocumentAttachment: vi.fn(),
  uploadFeedbackAttachment: vi.fn(),
  deleteUploadedFeedbackAttachment: vi.fn(),
}));

vi.mock('../services/api/projectApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/projectApi')>(
    '../services/api/projectApi'
  );

  return {
    ...actual,
    fetchProjectImplementationUnitOptions:
      fetchProjectImplementationUnitOptionsMock,
  };
});

describe('Project special statuses UI', () => {
  it('requires a reason for TAM_NGUNG and clears the textarea when switching back to a regular status', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ProjectFormModal
        type="ADD"
        data={{
          investment_mode: 'DAU_TU',
          payment_cycle: 'QUARTERLY',
        } as Project}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const statusLabel = screen.getByText('Trạng thái');
    expect(statusLabel).toHaveClass('block', 'text-xs', 'font-semibold', 'text-neutral', 'mb-1');
    expect(statusLabel).not.toHaveClass('uppercase');

    const getStatusTrigger = () =>
      within(screen.getByText('Trạng thái').closest('.col-span-1') as HTMLElement).getByRole('button');

    await user.type(screen.getByPlaceholderText('DA001'), 'DA-TN-TEST');
    await user.type(screen.getByPlaceholderText('Dự án triển khai...'), 'Dự án tạm ngưng cần lý do');

    const statusTrigger = getStatusTrigger();
    await user.click(statusTrigger);
    await user.click(screen.getByRole('button', { name: 'Tạm ngưng' }));

    const specialTrigger = getStatusTrigger();
    expect(specialTrigger).toHaveClass('border-amber-300');
    expect(within(specialTrigger).getByText('Tạm ngưng')).toBeInTheDocument();

    await screen.findByText('Lý do tạm ngưng');
    const reasonTextarea = screen.getByPlaceholderText('Nhập lý do tạm ngưng...');
    expect(reasonTextarea).toBeInTheDocument();
    const saveButton = screen.getByText('Lưu').closest('button');
    expect(saveButton).not.toBeNull();

    await user.click(saveButton as HTMLElement);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Lý do tạm ngưng là bắt buộc')).toBeInTheDocument();

    await user.type(reasonTextarea, 'Chờ phê duyệt ngân sách.');
    await user.click(saveButton as HTMLElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'TAM_NGUNG',
          status_reason: 'Chờ phê duyệt ngân sách.',
        })
      );
    });

    await user.click(getStatusTrigger());
    await user.click(screen.getByRole('button', { name: 'Thực hiện đầu tư' }));
    expect(screen.queryByPlaceholderText('Nhập lý do tạm ngưng...')).not.toBeInTheDocument();
  });

  it('shows special-status badges and allows filtering by HUY in the project list', async () => {
    const user = userEvent.setup();
    const customers: Customer[] = [
      {
        id: 1,
        uuid: 'customer-1',
        customer_code: 'KH001',
        customer_name: 'Khách hàng A',
        tax_code: '0101010101',
        address: 'Hà Nội',
      },
    ];
    const projects: Project[] = [
      {
        id: 1,
        project_code: 'DA-TN',
        project_name: 'Du an tam ngung',
        customer_id: 1,
        status: 'TAM_NGUNG',
        status_reason: 'Chờ cấp vốn',
        investment_mode: 'DAU_TU',
      },
      {
        id: 2,
        project_code: 'DA-HUY',
        project_name: 'Du an huy',
        customer_id: 1,
        status: 'HUY',
        status_reason: 'Ngừng theo đề nghị khách hàng',
        investment_mode: 'DAU_TU',
      },
    ];

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    const pausedRow = screen.getByText('Du an tam ngung').closest('tr');
    const cancelledRow = screen.getByText('Du an huy').closest('tr');

    expect(pausedRow).not.toBeNull();
    expect(cancelledRow).not.toBeNull();
    expect(within(pausedRow as HTMLElement).getByTitle('Tạm ngưng')).toHaveClass('bg-amber-100', 'text-amber-800');
    expect(within(cancelledRow as HTMLElement).getByTitle('Huỷ')).toHaveClass('bg-red-100', 'text-red-800');

    await user.click(screen.getByRole('button', { name: 'Tất cả trạng thái' }));
    await user.click(screen.getByRole('button', { name: 'Huỷ' }));

    expect(screen.getByText('Du an huy')).toBeInTheDocument();
    expect(screen.queryByText('Du an tam ngung')).not.toBeInTheDocument();
  });

  it('limits the department filter to direct children of BGĐVT and excludes PKT', async () => {
    const user = userEvent.setup();
    const departments: Department[] = [
      {
        id: 1,
        dept_code: 'BGĐVT',
        dept_name: 'Ban giám đốc Viễn Thông',
        parent_id: null,
        dept_path: 'BGĐVT',
        is_active: true,
      },
      {
        id: 2,
        dept_code: 'TTH',
        dept_name: 'Tổ tổng hợp',
        parent_id: 1,
        dept_path: 'BGĐVT/TTH',
        is_active: true,
      },
      {
        id: 3,
        dept_code: 'TTKDGP',
        dept_name: 'Trung tâm Kinh doanh Giải pháp',
        parent_id: 1,
        dept_path: 'BGĐVT/TTKDGP',
        is_active: true,
      },
      {
        id: 4,
        dept_code: 'PKT',
        dept_name: 'Phòng Kế toán',
        parent_id: 1,
        dept_path: 'BGĐVT/PKT',
        is_active: true,
      },
      {
        id: 5,
        dept_code: 'PGP2',
        dept_name: 'Phòng giải pháp 2',
        parent_id: 3,
        dept_path: 'BGĐVT/TTKDGP/PGP2',
        is_active: true,
      },
    ];

    render(
      <ProjectList
        projects={[]}
        customers={[]}
        departments={departments}
        onOpenModal={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Tất cả phòng ban' }));
    const searchInput = screen.getByRole('textbox', { name: 'Tìm kiếm...' });

    await user.type(searchInput, 'TTH');
    expect(screen.getByRole('button', { name: 'Tổ tổng hợp' })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'TTKDGP');
    expect(screen.getByRole('button', { name: 'Trung tâm Kinh doanh Giải pháp' })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'PKT');
    expect(screen.queryByRole('button', { name: 'Phòng Kế toán' })).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'PGP2');
    expect(screen.queryByRole('button', { name: 'Phòng giải pháp 2' })).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'BGĐVT');
    expect(screen.queryByRole('button', { name: /BGĐVT - Ban giám đốc Viễn Thông/ })).not.toBeInTheDocument();
  });

  it('hides repeated customer details in the project name and customer columns', () => {
    const customers: Customer[] = [
      {
        id: 1,
        uuid: 'customer-hg',
        customer_code: '93105',
        customer_name: 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',
        tax_code: '6300123456',
        address: 'Hậu Giang',
      },
    ];
    const projects: Project[] = [
      {
        id: 16,
        project_code: 'DA016',
        project_name: 'Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',
        customer_id: 1,
        status: 'CHUAN_BI',
        investment_mode: 'DAU_TU',
      },
    ];

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    const row = screen.getByText('Dự án Dịch vụ giám sát SOC').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('93105 - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang')).not.toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang')).not.toBeInTheDocument();
  });

  it('keeps the update button responsive and prevents duplicate submits while saving', async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          id: 1,
          project_code: 'DA-EDIT',
          project_name: 'Du an can cap nhat',
          customer_id: null,
          status: 'CO_HOI',
          investment_mode: 'DAU_TU',
          payment_cycle: 'QUARTERLY',
          start_date: '2026-03-27',
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const saveButton = screen.getByText('Cập nhật').closest('button');
    expect(saveButton).not.toBeNull();

    await user.click(saveButton as HTMLElement);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(saveButton).toBeDisabled();
    expect(screen.getByText('Đang lưu...').closest('button')).toBeDisabled();
    expect(screen.getByText('Hủy').closest('button')).toBeDisabled();

    await user.click(screen.getByText('Đang lưu...').closest('button') as HTMLElement);
    expect(onSave).toHaveBeenCalledTimes(1);

    resolveSave?.();

    await waitFor(() => {
      expect(screen.getByText('Cập nhật').closest('button')).not.toBeDisabled();
      expect(screen.getByText('Hủy').closest('button')).not.toBeDisabled();
    });
  });
});
