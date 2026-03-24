import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Customer, Opportunity, OpportunityStageOption } from '../types';
import { CustomerList } from '../components/CustomerList';
import { OpportunityList } from '../components/OpportunityList';

const customers: Customer[] = [
  {
    id: '1',
    uuid: 'customer-1',
    customer_code: 'KH001',
    customer_name: 'Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM',
    tax_code: '0101010101',
    address: 'Số 1 đường Trần Hưng Đạo, phường có địa chỉ rất dài để kiểm tra hiển thị wrap trên desktop và mobile',
  },
  {
    id: '2',
    uuid: 'customer-2',
    customer_code: 'KH002',
    customer_name: 'Zeta Trung tâm y tế',
    tax_code: '0202020202',
    address: 'Sóc Trăng',
  },
];

const opportunityStageOptions: OpportunityStageOption[] = [
  {
    id: 'stage-1',
    stage_code: 'NEW',
    stage_name: 'Mới',
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'stage-2',
    stage_code: 'WON',
    stage_name: 'Thắng',
    is_active: true,
    sort_order: 2,
  },
];

const opportunities: Opportunity[] = [
  {
    id: 'opp-2',
    opp_name: 'Cơ hội Zeta',
    customer_id: '2',
    amount: 100000000,
    stage: 'NEW',
    priority: 2,
  },
  {
    id: 'opp-1',
    opp_name: 'Cơ hội triển khai hệ thống y tế rất dài để kiểm tra responsive và xuống dòng đúng cột',
    customer_id: '1',
    amount: 250000000,
    stage: 'WON',
    priority: 4,
  },
];

describe('CRM responsive list screens', () => {
  it('keeps long customer names and addresses wrapped in the customer desktop table and supports small-screen sorting', async () => {
    const user = userEvent.setup();

    render(
      <CustomerList
        customers={[customers[1], customers[0]]}
        onOpenModal={vi.fn()}
      />
    );

    const desktopTable = screen.getByTestId('customer-desktop-table');
    expect(desktopTable).toHaveClass('table-fixed');

    const longCustomerName = 'Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM';
    expect(within(desktopTable).getByText(longCustomerName)).toHaveClass('whitespace-normal', 'break-words', 'leading-6');

    const longAddress = 'Số 1 đường Trần Hưng Đạo, phường có địa chỉ rất dài để kiểm tra hiển thị wrap trên desktop và mobile';
    expect(within(desktopTable).getByText(longAddress)).toHaveClass('whitespace-normal', 'break-words', 'leading-6');

    const responsiveList = screen.getByTestId('customer-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách khách hàng');
    await user.selectOptions(sortSelect, 'customer_name:asc');
    expect(sortSelect).toHaveValue('customer_name:asc');

    const cards = Array.from(responsiveList.querySelectorAll('article'));
    expect(cards[0]).toHaveTextContent('Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM');
    expect(cards[1]).toHaveTextContent('Zeta Trung tâm y tế');
  });

  it('keeps long opportunity and customer names wrapped in the opportunity desktop table and supports small-screen sorting', async () => {
    const user = userEvent.setup();

    render(
      <OpportunityList
        opportunities={opportunities}
        opportunityStageOptions={opportunityStageOptions}
        customers={customers}
        personnel={[]}
        products={[]}
        employees={[]}
        onOpenModal={vi.fn()}
        onConvert={vi.fn()}
      />
    );

    const desktopTable = screen.getByTestId('opportunity-desktop-table');
    expect(desktopTable).toHaveClass('table-fixed');

    const longOpportunityName = 'Cơ hội triển khai hệ thống y tế rất dài để kiểm tra responsive và xuống dòng đúng cột';
    expect(within(desktopTable).getByText(longOpportunityName)).toHaveClass('whitespace-normal', 'break-words', 'leading-6');

    const longCustomerLabel = 'KH001 - Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM';
    expect(within(desktopTable).getByText(longCustomerLabel)).toHaveClass('whitespace-normal', 'break-words', 'leading-6');

    const responsiveList = screen.getByTestId('opportunity-responsive-list');
    expect(responsiveList).toHaveClass('grid', 'md:grid-cols-2', 'lg:hidden');

    const sortSelect = screen.getByLabelText('Sắp xếp danh sách cơ hội');
    await user.selectOptions(sortSelect, 'customer_id:asc');
    expect(sortSelect).toHaveValue('customer_id:asc');

    const cards = Array.from(responsiveList.querySelectorAll('article'));
    expect(cards[0]).toHaveTextContent('KH001 - Alpha Bệnh viện đa khoa khu vực có tên khách hàng rất dài để kiểm tra responsive CRM');
    expect(cards[1]).toHaveTextContent('KH002 - Zeta Trung tâm y tế');
  });
});
