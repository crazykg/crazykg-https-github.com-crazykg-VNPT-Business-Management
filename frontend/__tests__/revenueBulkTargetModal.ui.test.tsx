import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Department } from '../types';
import { RevenueBulkTargetModal } from '../components/revenue-mgmt/RevenueBulkTargetModal';

const apiSpies = vi.hoisted(() => ({
  bulkCreateRevenueTargets: vi.fn(),
}));

vi.mock('../services/v5Api', () => ({
  bulkCreateRevenueTargets: apiSpies.bulkCreateRevenueTargets,
}));

const departments = [
  { id: 1, dept_name: 'Kinh doanh số' } as Department,
];

describe('RevenueBulkTargetModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiSpies.bulkCreateRevenueTargets.mockResolvedValue({
      data: { created: 1, updated: 0 },
    });
  });

  it('submits the selected target_type in the bulk payload', async () => {
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
    const inputs = screen.getAllByRole('spinbutton');
    await user.type(inputs[0], '1200000');
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));
    await user.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));

    await waitFor(() => {
      expect(apiSpies.bulkCreateRevenueTargets).toHaveBeenCalledTimes(1);
    });

    expect(apiSpies.bulkCreateRevenueTargets).toHaveBeenCalledWith(
      expect.objectContaining({
        year: 2026,
        period_type: 'MONTHLY',
        target_type: 'RENEWAL',
        dept_ids: [0],
      })
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
