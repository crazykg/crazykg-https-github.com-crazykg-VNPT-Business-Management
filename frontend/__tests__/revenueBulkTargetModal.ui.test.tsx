import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Department } from '../types';
import { RevenueBulkTargetModal } from '../components/revenue-mgmt/RevenueBulkTargetModal';

const apiSpies = vi.hoisted(() => ({
  fetchRevenueTargetSuggestion: vi.fn(),
}));
const hookSpies = vi.hoisted(() => ({
  bulkSetRevenueTargets: vi.fn(),
}));

vi.mock('../services/v5Api', () => ({
  fetchRevenueTargetSuggestion: apiSpies.fetchRevenueTargetSuggestion,
}));

vi.mock('../shared/hooks/useRevenue', () => ({
  useBulkSetRevenueTargets: () => ({
    mutateAsync: hookSpies.bulkSetRevenueTargets,
  }),
}));

const departments = [
  { id: 1, dept_name: 'Kinh doanh số' } as Department,
];

describe('RevenueBulkTargetModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hookSpies.bulkSetRevenueTargets.mockResolvedValue({
      data: { created: 1, updated: 0 },
    });

    apiSpies.fetchRevenueTargetSuggestion.mockResolvedValue({
      data: [
        {
          period_key: '2026-11',
          contract_amount: 0,
          opportunity_amount: 500000000,
          suggested_total: 500000000,
          contract_count: 0,
          opportunity_count: 1,
        },
      ],
      meta: { year: 2026, period_type: 'MONTHLY', total_suggested: 500000000 },
      preview: {
        project_total: 500000000,
        contract_total: 0,
        project_sources: [
          {
            project_id: 95,
            project_code: 'DA003',
            project_name: 'Dự án HIS',
            investment_mode: 'DAU_TU',
            project_status: 'CO_HOI',
            dept_id: 1,
            department_name: 'Kinh doanh số',
            schedule_count: 1,
            total_amount: 500000000,
            periods: [
              {
                cycle_number: 1,
                expected_date: '2026-11-25',
                expected_amount: 500000000,
                period_key: '2026-11',
              },
            ],
          },
        ],
        contract_sources: [],
      },
    });
  });

  it('opens preview modal and only applies suggestions after confirmation', async () => {
    const user = userEvent.setup();

    render(
      <RevenueBulkTargetModal
        year={2026}
        departments={departments}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const novemberInput = screen.getByLabelText('Kế hoạch Tháng 11') as HTMLInputElement;
    expect(novemberInput.value).toBe('');

    await user.click(screen.getByRole('button', { name: /đề xuất từ dữ liệu/i }));

    await waitFor(() => {
      expect(apiSpies.fetchRevenueTargetSuggestion).toHaveBeenCalledWith({
        year: 2026,
        period_type: 'MONTHLY',
        dept_id: 0,
        include_breakdown: true,
      });
    });

    expect(screen.getByText('Kiểm tra dữ liệu gợi ý kế hoạch doanh thu')).toBeInTheDocument();
    expect(screen.getByText('DA003')).toBeInTheDocument();
    expect(screen.getByText('Đơn vị')).toBeInTheDocument();
    expect(screen.getByText('Kinh doanh số')).toBeInTheDocument();
    expect(screen.queryByText('Người phụ trách A')).not.toBeInTheDocument();
    expect(novemberInput.value).toBe('');

    await user.click(screen.getByRole('button', { name: /xác nhận đưa vào kế hoạch/i }));

    await waitFor(() => {
      expect(screen.queryByText('Kiểm tra dữ liệu gợi ý kế hoạch doanh thu')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText('Kế hoạch Tháng 11')).toHaveValue('500.000.000');
    expect(screen.getByText(/Nguồn đã xác nhận:/i)).toBeInTheDocument();
  });

  it('submits vietnamese-formatted amounts with the selected target type', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(
      <RevenueBulkTargetModal
        year={2026}
        departments={departments}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    await user.selectOptions(screen.getByLabelText('Nhóm kế hoạch'), 'RENEWAL');

    const januaryInput = screen.getByLabelText('Kế hoạch Tháng 1');
    await user.type(januaryInput, '1200000,5');

    expect(januaryInput).toHaveValue('1.200.000,5');

    await user.click(screen.getByRole('button', { name: /lưu kế hoạch/i }));

    await waitFor(() => {
      expect(hookSpies.bulkSetRevenueTargets).toHaveBeenCalledTimes(1);
    });

    expect(hookSpies.bulkSetRevenueTargets).toHaveBeenCalledWith({
      year: 2026,
      period_type: 'MONTHLY',
      target_type: 'RENEWAL',
      dept_ids: [0],
      targets: [
        {
          period_key: '2026-01',
          amount: 1200000.5,
        },
      ],
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('renders the department selector in a compact layout', () => {
    render(
      <RevenueBulkTargetModal
        year={2026}
        departments={departments}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText('Có thể chọn nhiều đơn vị hoặc chọn Toàn công ty.')).toBeInTheDocument();

    const departmentTrigger = screen.getByRole('button', { name: 'Đơn vị áp dụng' });
    expect(departmentTrigger.className).toContain('!h-8');
    expect(departmentTrigger.className).toContain('!min-h-0');
    expect(departmentTrigger.className).toContain('!text-xs');
  });
});
