import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProcessFieldInput } from '../components/customer-request/CustomerRequestFieldRenderer';
import type { CustomerPersonnel, Employee, ProjectItemMaster, SupportServiceGroup, YeuCauProcessField } from '../types';

const renderField = (field: YeuCauProcessField, value: unknown = '') => {
  const customers = [
    {
      id: 20,
      uuid: 'customer-20',
      customer_code: 'C020',
      customer_name: 'Bệnh viện Sản - Nhi Hậu Giang',
      tax_code: '0123456789',
      address: 'Hậu Giang',
    },
  ];

  const employees: Employee[] = [];
  const customerPersonnel: CustomerPersonnel[] = [];
  const projectItems: ProjectItemMaster[] = [];
  const supportServiceGroups: SupportServiceGroup[] = [
    {
      id: 11,
      group_code: 'ZT-01',
      group_name: 'Zalo hỗ trợ BH',
      customer_id: 20,
      customer_name: 'Bệnh viện Sản - Nhi Hậu Giang',
    } as SupportServiceGroup,
  ];

  return render(
    <ProcessFieldInput
      field={field}
      value={value}
      customers={customers}
      employees={employees}
      customerPersonnel={customerPersonnel}
      supportServiceGroups={supportServiceGroups}
      projectItems={projectItems}
      selectedCustomerId="20"
      disabled={false}
      density="compact"
      onChange={vi.fn()}
    />
  );
};

describe('CustomerRequestFieldRenderer', () => {
  it('renders source_channel as a single-line input to keep the form row aligned', () => {
    const { container } = renderField(
      {
        name: 'source_channel',
        label: 'Kênh khác',
        type: 'textarea',
        required: false,
      },
      'Zalo OA'
    );

    expect(container.querySelector('textarea')).toBeNull();
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input).toHaveValue('Zalo OA');
    expect(input).toHaveClass('h-9');
    expect(input).toHaveClass('text-sm');
    expect(input).toHaveClass('rounded');
  });

  it('renames support group selection to Zalo/Tele in the shared form renderer', () => {
    renderField({
      name: 'support_service_group_id',
      label: 'Kênh tiếp nhận',
      type: 'support_group_select',
      required: false,
    });

    expect(screen.getByText('Zalo/Tele')).toBeInTheDocument();
    expect(screen.queryByText('Kênh tiếp nhận')).not.toBeInTheDocument();
    expect(screen.getByText('Chọn zalo/tele')).toBeInTheDocument();
    const selectTrigger = screen.getByRole('button', { name: 'Zalo/Tele' });
    expect(selectTrigger).toHaveClass('h-9');
    expect(selectTrigger).toHaveClass('text-sm');
    expect(selectTrigger).toHaveClass('rounded');
  });
});
