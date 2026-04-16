import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcedureTemplateManagement } from '../components/ProcedureTemplateManagement';
import type { ProcedureTemplate, ProcedureTemplateStep } from '../types/project';

const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());
const fetchProcedureTemplateStepsMock = vi.hoisted(() => vi.fn());
const createProcedureTemplateMock = vi.hoisted(() => vi.fn());
const updateProcedureTemplateMock = vi.hoisted(() => vi.fn());
const deleteProcedureTemplateMock = vi.hoisted(() => vi.fn());
const createProcedureTemplateStepMock = vi.hoisted(() => vi.fn());
const updateProcedureTemplateStepMock = vi.hoisted(() => vi.fn());
const deleteProcedureTemplateStepMock = vi.hoisted(() => vi.fn());
const deleteProcedureTemplateStepsMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api/projectApi', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
  fetchProcedureTemplateSteps: fetchProcedureTemplateStepsMock,
  createProcedureTemplate: createProcedureTemplateMock,
  updateProcedureTemplate: updateProcedureTemplateMock,
  deleteProcedureTemplate: deleteProcedureTemplateMock,
  createProcedureTemplateStep: createProcedureTemplateStepMock,
  updateProcedureTemplateStep: updateProcedureTemplateStepMock,
  deleteProcedureTemplateStep: deleteProcedureTemplateStepMock,
  deleteProcedureTemplateSteps: deleteProcedureTemplateStepsMock,
}));

const emptyTemplate: ProcedureTemplate = {
  id: 1,
  template_code: 'CHECK_LIST_HD',
  template_name: 'CheckList hợp đồng',
  description: 'Mẫu rỗng',
  is_active: true,
  steps_count: 0,
  procedures_count: 0,
  can_delete: true,
};

const templateUsedByProject: ProcedureTemplate = {
  id: 2,
  template_code: 'DAU_TU',
  template_name: 'Đầu tư',
  is_active: true,
  steps_count: 0,
  procedures_count: 1,
  can_delete: false,
};

const templateWithSteps: ProcedureTemplate = {
  id: 3,
  template_code: 'THU_TUC_NHANH',
  template_name: 'Thủ tục cần xoá nhanh',
  is_active: true,
  steps_count: 3,
  procedures_count: 0,
  can_delete: false,
};

const templateSteps: ProcedureTemplateStep[] = [
  {
    id: 101,
    template_id: templateWithSteps.id,
    step_number: 1,
    parent_step_id: null,
    phase: 'CHUAN_BI',
    step_name: 'Bước cha',
    step_detail: null,
    lead_unit: 'Đơn vị A',
    support_unit: null,
    expected_result: 'Kết quả A',
    default_duration_days: 3,
    sort_order: 10,
  },
  {
    id: 102,
    template_id: templateWithSteps.id,
    step_number: 2,
    parent_step_id: 101,
    phase: 'CHUAN_BI',
    step_name: 'Bước con',
    step_detail: null,
    lead_unit: 'Đơn vị B',
    support_unit: null,
    expected_result: 'Kết quả B',
    default_duration_days: 1,
    sort_order: 20,
  },
  {
    id: 103,
    template_id: templateWithSteps.id,
    step_number: 3,
    parent_step_id: null,
    phase: 'THUC_HIEN',
    step_name: 'Bước độc lập',
    step_detail: null,
    lead_unit: 'Đơn vị C',
    support_unit: null,
    expected_result: 'Kết quả C',
    default_duration_days: 2,
    sort_order: 30,
  },
];

describe('ProcedureTemplateManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    fetchProcedureTemplateStepsMock.mockResolvedValue([]);
    createProcedureTemplateMock.mockResolvedValue({});
    updateProcedureTemplateMock.mockResolvedValue({});
    deleteProcedureTemplateMock.mockResolvedValue(undefined);
    createProcedureTemplateStepMock.mockResolvedValue({});
    updateProcedureTemplateStepMock.mockResolvedValue({});
    deleteProcedureTemplateStepMock.mockResolvedValue(undefined);
    deleteProcedureTemplateStepsMock.mockResolvedValue(undefined);
  });

  it('shows only the template name in the dropdown options', async () => {
    fetchProcedureTemplatesMock.mockResolvedValue([emptyTemplate]);

    render(<ProcedureTemplateManagement />);

    await waitFor(() => expect(fetchProcedureTemplatesMock).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('option', { name: /^CheckList hợp đồng$/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /CHECK_LIST_HD/i })).not.toBeInTheDocument();
  });

  it('allows deleting a template when it has no steps and no applied procedures', async () => {
    const user = userEvent.setup();
    fetchProcedureTemplatesMock
      .mockResolvedValueOnce([emptyTemplate])
      .mockResolvedValueOnce([]);

    render(<ProcedureTemplateManagement />);

    await waitFor(() => expect(fetchProcedureTemplatesMock).toHaveBeenCalledTimes(1));

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Chọn mẫu/i }),
      String(emptyTemplate.id),
    );

    await waitFor(() => expect(fetchProcedureTemplateStepsMock).toHaveBeenCalledWith(emptyTemplate.id));

    await user.click(screen.getByRole('button', { name: /Xóa mẫu/i }));

    await waitFor(() => {
      expect(deleteProcedureTemplateMock).toHaveBeenCalledWith(emptyTemplate.id);
    });
    await waitFor(() => expect(fetchProcedureTemplatesMock).toHaveBeenCalledTimes(2));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      expect.stringContaining(emptyTemplate.template_code),
    );
    expect(screen.getByText(/Chọn một mẫu thủ tục để xem và chỉnh sửa/i)).toBeInTheDocument();
  });

  it('shows a clear message and does not call delete when the template already has data', async () => {
    const user = userEvent.setup();
    fetchProcedureTemplatesMock.mockResolvedValue([templateUsedByProject]);

    render(<ProcedureTemplateManagement />);

    await waitFor(() => expect(fetchProcedureTemplatesMock).toHaveBeenCalledTimes(1));

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Chọn mẫu/i }),
      String(templateUsedByProject.id),
    );

    await waitFor(() => expect(fetchProcedureTemplateStepsMock).toHaveBeenCalledWith(templateUsedByProject.id));

    await user.click(screen.getByRole('button', { name: /Xóa mẫu/i }));

    expect(deleteProcedureTemplateMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByText(/Chỉ có thể xóa mẫu khi chưa có bước cấu hình và chưa được áp dụng cho dự án/i),
      ).toBeInTheDocument();
    });
  });

  it('supports check all to bulk delete selected steps in one request and locks controls while deleting', async () => {
    const user = userEvent.setup();
    fetchProcedureTemplatesMock.mockResolvedValue([templateWithSteps]);
    let releaseBulkDelete: (() => void) | undefined;
    deleteProcedureTemplateStepsMock.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseBulkDelete = () => resolve();
    }));
    fetchProcedureTemplateStepsMock
      .mockResolvedValueOnce(templateSteps)
      .mockResolvedValueOnce([]);

    render(<ProcedureTemplateManagement />);

    await waitFor(() => expect(fetchProcedureTemplatesMock).toHaveBeenCalledTimes(1));

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Chọn mẫu/i }),
      String(templateWithSteps.id),
    );

    await waitFor(() => expect(fetchProcedureTemplateStepsMock).toHaveBeenCalledWith(templateWithSteps.id));
    await screen.findByText('Bước cha');

    await user.click(screen.getByRole('checkbox', { name: /Chọn tất cả bước hiển thị/i }));
    await user.click(screen.getByRole('button', { name: /Xóa đã chọn \(3\)/i }));

    await waitFor(() => {
      expect(deleteProcedureTemplateStepsMock).toHaveBeenCalledWith(templateWithSteps.id, ['101', '102', '103']);
    });
    expect(screen.getByRole('button', { name: /Đang xóa/i })).toBeDisabled();
    expect(screen.getAllByTitle('Xoá')[0]).toBeDisabled();

    expect(releaseBulkDelete).toBeDefined();
    releaseBulkDelete?.();

    await waitFor(() => {
      expect(fetchProcedureTemplateStepsMock).toHaveBeenCalledTimes(2);
    });
    expect(deleteProcedureTemplateStepsMock).toHaveBeenCalledTimes(1);
    expect(globalThis.confirm).toHaveBeenCalledWith('Xóa 3 bước đã chọn?');
  });
});
