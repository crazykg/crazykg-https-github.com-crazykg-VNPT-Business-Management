import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCauSearchItem } from '../types';
import { CustomerRequestSearchBox } from '../components/customer-request/CustomerRequestSearchBox';

const makeSearchItem = (partial?: Partial<YeuCauSearchItem>): YeuCauSearchItem => ({
  id: partial?.id ?? 15,
  request_code: partial?.request_code ?? 'CRC-202603-0315',
  summary: partial?.summary ?? 'Lỗi báo cáo doanh thu',
  label: partial?.label ?? 'CRC-202603-0315 - Lỗi báo cáo doanh thu',
  customer_name: partial?.customer_name ?? 'VNPT HCM',
  project_name: partial?.project_name ?? 'Báo cáo tổng hợp',
  current_status_code: partial?.current_status_code ?? 'completed',
  current_status_name_vi: partial?.current_status_name_vi ?? 'Hoàn thành',
  dispatcher_name: partial?.dispatcher_name ?? 'Trần PM',
  performer_name: partial?.performer_name ?? 'Ngô Dev',
  updated_at: partial?.updated_at ?? '2026-03-21 09:00:00',
});

describe('CustomerRequestSearchBox UI', () => {
  it('renders results and forwards selected request', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const item = makeSearchItem();

    render(
      <CustomerRequestSearchBox
        value="CRC"
        onChange={onChange}
        results={[item]}
        error=""
        loading={false}
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('CRC-202603-0315')).toBeInTheDocument();
    expect(screen.getByText(/Lỗi báo cáo doanh thu/)).toBeInTheDocument();
    expect(screen.getByText(/Điều phối: Trần PM/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /CRC-202603-0315/i }));
    expect(onSelect).toHaveBeenCalledWith(item);
  });
});
