import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFormModal } from '../components/modals';
import type { ProcedureTemplate, Project } from '../types';

const PROJECT_FORM_SUBMIT_TIMEOUT_MS = 16000;
const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());

fetchProcedureTemplatesMock.mockResolvedValue([
  {
    id: 1,
    template_code: 'DAU_TU',
    template_name: 'Đầu tư',
    is_active: true,
    phases: ['CHUAN_BI', 'THUC_HIEN_DAU_TU'],
  },
] as ProcedureTemplate[]);

vi.mock('../services/v5Api', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
  deleteUploadedDocumentAttachment: vi.fn(),
  uploadDocumentAttachment: vi.fn(),
  uploadFeedbackAttachment: vi.fn(),
  deleteUploadedFeedbackAttachment: vi.fn(),
}));

const baseProjectData: Project = {
  id: 300,
  project_code: 'DA300',
  project_name: 'Dự án kiểm tra payload save',
  customer_id: 1,
  status: 'CHUAN_BI',
  investment_mode: 'DAU_TU',
  payment_cycle: 'QUARTERLY',
  start_date: '2026-02-25',
  expected_end_date: '2026-11-25',
  actual_end_date: null,
  items: [
    {
      id: 'ITEM_1',
      productId: '11',
      product_id: 11,
      quantity: 1,
      unitPrice: 10000000,
      unit_price: 10000000,
      discountPercent: 0,
      discountAmount: 0,
      lineTotal: 10000000,
      line_total: 10000000,
    },
  ],
  raci: [
    {
      id: 'RACI_1',
      userId: '22',
      user_id: 22,
      roleType: 'R',
      raci_role: 'R',
      assignedDate: '28/03/2026',
    },
  ],
} as Project;

describe('ProjectFormModal save payload', () => {
  it('does not sync items or raci when only general project info is saved', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.project_code).toBe('DA300');
    expect(payload.project_name).toBe('Dự án kiểm tra payload save');
    expect(payload.start_date).toBe('2026-02-25');
    expect(payload.expected_end_date).toBe('2026-11-25');
    expect(payload.actual_end_date).toBeNull();
    expect(payload.items).toBeUndefined();
    expect(payload.raci).toBeUndefined();
  });

  it('syncs project items after the items tab is edited', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        initialTab="items"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: /Thêm hạng mục/i }));
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items).toHaveLength(2);
    expect(payload.raci).toBeUndefined();
  });

  it('requires and normalizes payment_cycle when saving an investment project', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          payment_cycle: 'Hàng quý',
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Chu kỳ thanh toán')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Hàng quý/i }));
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.status).toBe('CHUAN_BI');
    expect(payload.payment_cycle).toBe('QUARTERLY');
  });

  it('blocks saving when Thuê dịch vụ CNTT có sẵn is selected without a payment cycle', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          investment_mode: 'THUE_DICH_VU_COSAN',
          payment_cycle: null,
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Chu kỳ thanh toán')).toBeInTheDocument();
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Chu kỳ thanh toán là bắt buộc với loại dự án đã chọn.')).toBeInTheDocument();
  });

  it('shows an inline success notice after saving while keeping the modal open', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <React.StrictMode>
        <ProjectFormModal
          type="EDIT"
          data={baseProjectData}
          customers={[]}
          products={[]}
          employees={[]}
          departments={[]}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </React.StrictMode>
    );

    await user.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Đã cập nhật dự án\. Modal vẫn mở để tiếp tục thao tác\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đang lưu/i })).not.toBeInTheDocument();
  });

  it('releases the save button when the project save promise hangs', async () => {
    vi.useFakeTimers();
    const onNotify = vi.fn();
    const onSave = vi.fn(() => new Promise<void>(() => {}));
    try {
      render(
        <ProjectFormModal
          type="EDIT"
          data={{
            ...baseProjectData,
            status: 'CO_HOI',
            payment_cycle: 'QUARTERLY',
          }}
          customers={[]}
          products={[]}
          employees={[]}
          departments={[]}
          onClose={vi.fn()}
          onSave={onSave}
          onNotify={onNotify}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

      expect(screen.getByRole('button', { name: /Đang lưu/i })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(PROJECT_FORM_SUBMIT_TIMEOUT_MS + 1);
        await Promise.resolve();
      });

      expect(screen.getByRole('button', { name: /Cập nhật/i })).toBeInTheDocument();
      expect(screen.getByText('Không thể cập nhật dự án (quá thời gian phản hồi). Vui lòng thử lại.')).toBeInTheDocument();
      expect(onNotify).toHaveBeenCalledWith(
        'error',
        'Lưu thất bại',
        'Không thể cập nhật dự án (quá thời gian phản hồi). Vui lòng thử lại.'
      );
    } finally {
      vi.useRealTimers();
    }
  }, 10000);
});
