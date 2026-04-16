import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFormModal } from '../components/modals';
import type { Department, Employee, ProcedureTemplate, Project } from '../types';

const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());
const fetchProjectImplementationUnitOptionsMock = vi.hoisted(() => vi.fn());
const fetchProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const generateProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const syncProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());

vi.mock('../components/modals/selectPrimitives', () => ({
  SearchableSelect: ({
    value,
    options,
    onChange,
    placeholder = 'Chọn...',
    disabled = false,
  }: {
    value: string | number | null | undefined;
    options: Array<{ value: string | number; label: string }>;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <select
      data-testid="searchable-select"
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

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

const departments: Department[] = [
  {
    id: 2,
    dept_code: 'GP2',
    dept_name: 'Phòng giải Pháp 2',
    parent_id: null,
    dept_path: 'GP2',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: 22,
    user_code: 'CTV062802',
    full_name: 'Trần Thanh Duy',
    department_id: 2,
    username: 'duy',
    status: 'ACTIVE',
  } as Employee,
  {
    id: 23,
    user_code: 'CTV080346',
    full_name: 'Võ Hoàng Kiệt',
    department_id: 2,
    username: 'kiet',
    status: 'ACTIVE',
  } as Employee,
  {
    id: 24,
    user_code: 'CTV090001',
    full_name: 'Nguyễn Nhật Trường',
    department_id: 2,
    username: 'truong',
    status: 'ACTIVE',
  } as Employee,
];

const buildProjectData = (raci: Project['raci']): Project => ({
  id: 300,
  project_code: 'DA300',
  project_name: 'Dự án kiểm tra 1 Accountable',
  customer_id: 1,
  status: 'CHUAN_BI',
  investment_mode: 'DAU_TU',
  payment_cycle: 'QUARTERLY',
  opportunity_score: 0,
  start_date: '2026-04-01',
  expected_end_date: '2026-12-31',
  actual_end_date: null,
  items: [],
  raci,
} as Project);

const getRoleValues = () => {
  const table = screen.getByRole('table');
  const dataRows = within(table).getAllByRole('row').slice(1);

  return dataRows.map((row) => {
    const selects = within(row).getAllByTestId('searchable-select');
    return (selects[1] as HTMLSelectElement).value;
  });
};

describe('ProjectFormModal accountable role normalization', () => {
  it('keeps only one accountable when old project data contains multiple A rows', () => {
    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_2',
            userId: '23',
            user_id: 23,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(getRoleValues()).toEqual(['R', 'A']);
    expect(getRoleValues().filter((value) => value === 'A')).toHaveLength(1);
  });

  it('shows a confirmation modal and keeps roles unchanged when the user cancels replacing the current accountable', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_2',
            userId: '23',
            user_id: 23,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const secondRoleSelect = within(rows[1]).getAllByTestId(
      'searchable-select'
    )[1] as HTMLSelectElement;

    fireEvent.change(secondRoleSelect, { target: { value: 'A' } });

    expect(
      screen.getByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Trần Thanh Duy đang giữ vai trò A/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Nếu tiếp tục, hệ thống sẽ cập nhật lại người giữ vai trò A trước đó bằng lựa chọn mới\./i)
    ).not.toBeInTheDocument();
    expect(getRoleValues()).toEqual(['A', 'R']);

    fireEvent.click(screen.getByRole('button', { name: /Huỷ thao tác/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
        })
      ).not.toBeInTheDocument();
    });

    expect(getRoleValues()).toEqual(['A', 'R']);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('treats closing the accountable warning by close button as cancelling the replacement', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_2',
            userId: '23',
            user_id: 23,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const secondRoleSelect = within(rows[1]).getAllByTestId(
      'searchable-select'
    )[1] as HTMLSelectElement;

    fireEvent.change(secondRoleSelect, { target: { value: 'A' } });

    expect(
      screen.getByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Đóng cảnh báo thay người chịu trách nhiệm A/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
        })
      ).not.toBeInTheDocument();
    });

    expect(getRoleValues()).toEqual(['A', 'R']);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('treats pressing Escape on the accountable warning as cancelling the replacement', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_2',
            userId: '23',
            user_id: 23,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const secondRoleSelect = within(rows[1]).getAllByTestId(
      'searchable-select'
    )[1] as HTMLSelectElement;

    fireEvent.change(secondRoleSelect, { target: { value: 'A' } });

    expect(
      screen.getByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
        })
      ).not.toBeInTheDocument();
    });

    expect(getRoleValues()).toEqual(['A', 'R']);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('copies a RACI row as a blank member so the user can pick another person without immediate duplicate warnings', () => {
    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
            full_name: 'Trần Thanh Duy',
            user_code: 'CTV062802',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const table = screen.getByRole('table');
    const initialRow = within(table).getAllByRole('row')[1] as HTMLTableRowElement;

    fireEvent.click(within(initialRow).getByTitle('Sao chép dòng này'));

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);

    const copiedSelects = within(rows[1]).getAllByTestId('searchable-select');
    expect((copiedSelects[0] as HTMLSelectElement).value).toBe('');
    expect((copiedSelects[1] as HTMLSelectElement).value).toBe('R');
    expect(
      screen.queryByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).not.toBeInTheDocument();
  });

  it('only asks to replace the current accountable after a different member is chosen on the copied row', async () => {
    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const table = screen.getByRole('table');
    const initialRow = within(table).getAllByRole('row')[1] as HTMLTableRowElement;

    fireEvent.click(within(initialRow).getByTitle('Sao chép dòng này'));

    let rows = within(table).getAllByRole('row').slice(1);
    const copiedSelects = within(rows[1]).getAllByTestId('searchable-select');
    const copiedUserSelect = copiedSelects[0] as HTMLSelectElement;
    const copiedRoleSelect = copiedSelects[1] as HTMLSelectElement;

    fireEvent.change(copiedRoleSelect, { target: { value: 'A' } });

    expect(
      screen.queryByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).not.toBeInTheDocument();

    fireEvent.change(copiedUserSelect, { target: { value: '24' } });

    expect(
      await screen.findByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Trần Thanh Duy đang giữ vai trò A/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
        })
      ).not.toBeInTheDocument();
    });

    rows = within(table).getAllByRole('row').slice(1);
    const committedCopySelects = within(rows[1]).getAllByTestId('searchable-select');
    expect((committedCopySelects[0] as HTMLSelectElement).value).toBe('24');
    expect((committedCopySelects[1] as HTMLSelectElement).value).toBe('A');
  });

  it('does not submit the project while the accountable confirmation modal is still open', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_2',
            userId: '23',
            user_id: 23,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const secondRoleSelect = within(rows[1]).getAllByTestId(
      'searchable-select'
    )[1] as HTMLSelectElement;

    fireEvent.change(secondRoleSelect, { target: { value: 'A' } });

    expect(
      screen.getByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });

    expect(
      screen.getByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();
    expect(getRoleValues()).toEqual(['A', 'R']);
  });

  it('requires confirmation before replacing the current accountable and saves one A only after the user continues', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_2',
            userId: '23',
            user_id: 23,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const secondRoleSelect = within(rows[1]).getAllByTestId(
      'searchable-select'
    )[1] as HTMLSelectElement;

    fireEvent.change(secondRoleSelect, { target: { value: 'A' } });

    expect(
      screen.getByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();
    expect(getRoleValues()).toEqual(['A', 'R']);

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
        })
      ).not.toBeInTheDocument();
    });

    expect(getRoleValues()).toEqual(['R', 'A']);

    fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.raci).toEqual([
      expect.objectContaining({
        userId: '22',
        user_id: '22',
        roleType: 'R',
        raci_role: 'R',
      }),
      expect.objectContaining({
        userId: '23',
        user_id: '23',
        roleType: 'A',
        raci_role: 'A',
      }),
    ]);
    expect(
      (payload.raci || []).filter((row) => row.roleType === 'A')
    ).toHaveLength(1);
  });

  it('drops the old A row when confirmed replacement would duplicate an existing R assignment for the same member', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        initialTab="raci"
        data={buildProjectData([
          {
            id: 'RACI_1',
            userId: '22',
            user_id: 22,
            roleType: 'A',
            raci_role: 'A',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_2',
            userId: '22',
            user_id: 22,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
          },
          {
            id: 'RACI_3',
            userId: '23',
            user_id: 23,
            roleType: 'R',
            raci_role: 'R',
            assignedDate: '11/04/2026',
          },
        ])}
        customers={[]}
        products={[]}
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const table = screen.getByRole('table');
    const rowsBefore = within(table).getAllByRole('row').slice(1);
    const thirdRoleSelect = within(rowsBefore[2]).getAllByTestId(
      'searchable-select'
    )[1] as HTMLSelectElement;

    fireEvent.change(thirdRoleSelect, { target: { value: 'A' } });

    expect(
      screen.getByRole('heading', {
        name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /Đã tồn tại người chịu trách nhiệm \(A\)/i,
        })
      ).not.toBeInTheDocument();
    });

    expect(getRoleValues()).toEqual(['R', 'A']);

    fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.raci).toEqual([
      expect.objectContaining({
        userId: '22',
        roleType: 'R',
      }),
      expect.objectContaining({
        userId: '23',
        roleType: 'A',
      }),
    ]);
    expect(payload.raci).toHaveLength(2);
  });
});
