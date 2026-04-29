import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  CascadingEntitySearchFilter,
  type CascadingEntitySearchValue,
} from '../components/CascadingEntitySearchFilter';
import type { Customer, Project, ProjectItemMaster } from '../types';

const customers: Customer[] = [
  {
    id: 'customer-a',
    uuid: 'customer-a',
    customer_code: 'KH-A',
    customer_name: 'Trạm y tế A',
    tax_code: '0101',
    address: 'Hà Nội',
  },
  {
    id: 'customer-b',
    uuid: 'customer-b',
    customer_code: 'KH-B',
    customer_name: 'Bệnh viện B',
    tax_code: '0202',
    address: 'Cần Thơ',
  },
];

const projects: Project[] = [
  {
    id: 'project-a',
    project_code: 'DA-A',
    project_name: 'Dự án A',
    customer_id: 'customer-a',
    status: 'CO_HOI',
    start_date: '2026-04-01',
  } as Project,
  {
    id: 'project-b',
    project_code: 'DA-B',
    project_name: 'Dự án B',
    customer_id: 'customer-b',
    status: 'CO_HOI',
    start_date: '2026-04-01',
  } as Project,
];

const projectItems: ProjectItemMaster[] = [
  {
    id: 'item-a',
    project_id: 'project-a',
    product_id: 'product-a',
    product_code: 'HIS',
    product_name: 'HIS Core',
    quantity: 1,
    unit_price: 1,
  },
  {
    id: 'item-b',
    project_id: 'project-b',
    product_id: 'product-b',
    product_code: 'CRM',
    product_name: 'CRM Care',
    quantity: 1,
    unit_price: 1,
  },
];

const emptyValue: CascadingEntitySearchValue = {
  customerIds: [],
  projectIds: [],
  productIds: [],
};

function CascadingFilterHarness() {
  const [value, setValue] = useState<CascadingEntitySearchValue>(emptyValue);
  const [textValue, setTextValue] = useState('');

  return (
    <>
      <CascadingEntitySearchFilter
        customers={customers}
        projects={projects}
        projectItems={projectItems}
        value={value}
        onChange={setValue}
        textValue={textValue}
        onTextChange={setTextValue}
        actions={<button type="button">Tìm</button>}
      />
      <output data-testid="filter-value">{JSON.stringify(value)}</output>
    </>
  );
}

const selectOption = async (
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  optionName: RegExp,
) => {
  await user.click(screen.getByRole('button', { name: triggerName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
};

describe('CascadingEntitySearchFilter', () => {
  it('limits project and product options by parent selections', async () => {
    const user = userEvent.setup();
    render(<CascadingFilterHarness />);

    await selectOption(user, 'Lọc theo khách hàng', /Trạm y tế A/);

    await user.click(screen.getByRole('button', { name: 'Lọc theo dự án' }));

    expect(await screen.findByRole('option', { name: /Dự án A/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Dự án B/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /Dự án A/ }));
    await user.click(screen.getByRole('button', { name: 'Lọc theo sản phẩm' }));

    expect(await screen.findByRole('option', { name: /HIS Core/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /CRM Care/ })).not.toBeInTheDocument();
  });

  it('prunes child selections when the selected parent scope changes', async () => {
    const user = userEvent.setup();
    render(<CascadingFilterHarness />);

    await selectOption(user, 'Lọc theo khách hàng', /Trạm y tế A/);
    await selectOption(user, 'Lọc theo dự án', /Dự án A/);
    await selectOption(user, 'Lọc theo sản phẩm', /HIS Core/);

    await user.click(screen.getByRole('button', { name: 'Lọc theo khách hàng' }));
    await user.click(await screen.findByRole('option', { name: /Bệnh viện B/ }));
    await user.click(screen.getByRole('option', { name: /Trạm y tế A/ }));

    await waitFor(() => {
      expect(screen.getByTestId('filter-value')).toHaveTextContent('"customerIds":["customer-b"]');
      expect(screen.getByTestId('filter-value')).toHaveTextContent('"projectIds":[]');
      expect(screen.getByTestId('filter-value')).toHaveTextContent('"productIds":[]');
    });
  });
});
