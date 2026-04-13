import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectRaciTab } from '../components/modals/ProjectTabs';
import type { Department, Employee, Project, ProjectRACI } from '../types';

const departments: Department[] = [
  {
    id: 10,
    dept_code: 'BGD',
    dept_name: 'Ban giám đốc Viễn Thông',
    parent_id: null,
    dept_path: 'BGD',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: 22,
    user_code: 'NV001',
    full_name: 'Nguyễn Văn A',
    department_id: 10,
    username: 'nva',
    status: 'ACTIVE',
  } as Employee,
];

const raciRows: ProjectRACI[] = [
  {
    id: 'RACI_1',
    userId: 22,
    roleType: 'R',
    assignedDate: '11/04/2026',
  },
];

describe('ProjectRaciTab layout', () => {
  it('keeps all row controls aligned to the same input height', () => {
    render(
      <ProjectRaciTab
        employees={employees}
        employeeOptions={[
          { value: 22, label: 'NV001 - Nguyễn Văn A' },
        ]}
        existingAccountableLabel=""
        formData={{ raci: raciRows } as Partial<Project>}
        handleAddRACI={vi.fn()}
        handleCopyRACI={vi.fn()}
        handleDownloadProjectRaciTemplate={vi.fn()}
        handleRaciAssignedDateBlur={vi.fn()}
        handleRemoveRACI={vi.fn()}
        handleUpdateRACI={vi.fn()}
        duplicateRaciIds={new Set()}
        isDepartmentsLoading={false}
        isProjectEmployeeOptionsLoading={false}
        isRaciImportSaving={false}
        onCancelAccountableReplacement={vi.fn()}
        onConfirmAccountableReplacement={vi.fn()}
        raciImportMenuRef={{ current: null }}
        raciImportSummary={null}
        resolveEmployeeDepartment={() => departments[0]}
        showAccountableConfirm={false}
        showRaciImportMenu={false}
        toggleRaciImportMenu={vi.fn()}
        triggerProjectRaciImport={vi.fn()}
      />
    );

    const employeeTrigger = screen.getByRole('button', { name: /NV001 - Nguyễn Văn A/i });
    const roleTrigger = screen.getByRole('button', { name: /R - Responsible/i });
    const assignedDateInput = screen.getByDisplayValue('11/04/2026');
    const departmentBox = screen.getByText('Ban giám đốc Viễn Thông').closest('div');

    expect(employeeTrigger).toHaveClass('h-8');
    expect(roleTrigger).toHaveClass('h-8');
    expect(assignedDateInput).toHaveClass('h-8');
    expect(departmentBox).toHaveClass('h-8');
  });
});
