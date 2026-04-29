// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useProcedureStepsState } from '../components/procedure/hooks/useProcedureStepsState';
import type { ProcedureStepRaciEntry, ProjectProcedure, ProjectProcedureStep } from '../types';

const activeProcedure = {
  id: 501,
  project_id: 101,
  template_id: 11,
  overall_progress: 0,
} as ProjectProcedure;

const makeStep = (overrides: Partial<ProjectProcedureStep> = {}): ProjectProcedureStep => ({
  id: 1001,
  procedure_id: 501,
  step_number: 1,
  step_name: 'Lập đề cương',
  phase: 'PHE_DUYET',
  sort_order: 1,
  parent_step_id: null,
  duration_days: 0,
  progress_status: 'CHUA_THUC_HIEN',
  actual_start_date: null,
  actual_end_date: null,
  ...overrides,
} as ProjectProcedureStep);

function HookHarness({
  step,
  nextStartDate = '2026-04-10',
  nextEndDate = '2026-04-15',
  onNotify = vi.fn(),
}: {
  step: ProjectProcedureStep;
  nextStartDate?: string;
  nextEndDate?: string;
  onNotify?: (type: string, title: string, message: string) => void;
}) {
  const inflightRef = React.useRef<Set<string>>(new Set());
  const [currentProcedure, setActiveProcedure] = React.useState<ProjectProcedure | null>(activeProcedure);
  const [, setSteps] = React.useState<ProjectProcedureStep[]>([step]);
  const [, setIsSaving] = React.useState(false);
  const [, setStepRaciMap] = React.useState<Record<string, ProcedureStepRaciEntry[]>>({});
  const state = useProcedureStepsState({
    activeProcedure: currentProcedure,
    inflightRef,
    onNotify,
    setActiveProcedure,
    setIsSaving,
    setStepRaciMap,
    setSteps,
  });

  return (
    <div>
      <button type="button" onClick={() => state.handleStartDateChange(step, nextStartDate)}>
        Set start
      </button>
      <button type="button" onClick={() => state.handleEndDateChange(step, nextEndDate)}>
        Set end
      </button>
      <button type="button" onClick={() => state.handleDateRangeBlur(step, 'start')}>
        Blur start
      </button>
      <button type="button" onClick={() => state.handleDateRangeBlur(step, 'end')}>
        Blur end
      </button>
      <button type="button" onClick={() => state.handleSave()}>
        Save
      </button>
      <pre data-testid="drafts">{JSON.stringify(state.drafts)}</pre>
    </div>
  );
}

describe('useProcedureStepsState schedule inference', () => {
  it('suy ra Đến ngày khi có Ngày và chưa có mốc Đến ngày hiện hữu', async () => {
    render(<HookHarness step={makeStep({ duration_days: 3 })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set start' }));

    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_start_date: '2026-04-10',
        actual_end_date: '2026-04-12',
      });
    });
  });

  it('suy ra Từ ngày khi có Ngày và chưa có mốc Từ ngày hiện hữu', async () => {
    render(<HookHarness step={makeStep({ duration_days: 3 })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set end' }));

    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_start_date: '2026-04-13',
        actual_end_date: '2026-04-15',
      });
    });
  });

  it('suy ra Ngày khi có Từ ngày và nhập Đến ngày', async () => {
    render(<HookHarness step={makeStep({ actual_start_date: '2026-04-10' })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set end' }));

    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_start_date: '2026-04-10',
        actual_end_date: '2026-04-15',
        duration_days: 6,
      });
    });
  });

  it('giữ Đến ngày hiện hữu khi đổi Từ ngày và tự tính lại Ngày', async () => {
    render(
      <HookHarness
        step={makeStep({ actual_start_date: '2026-04-30', duration_days: 1 })}
        nextStartDate="2026-04-24"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set start' }));

    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_start_date: '2026-04-24',
        actual_end_date: '2026-04-30',
        duration_days: 7,
      });
    });
  });

  it('giữ Từ ngày hiện hữu khi đổi Đến ngày và tự tính lại Ngày', async () => {
    render(
      <HookHarness
        step={makeStep({ actual_start_date: '2026-04-24', duration_days: 1 })}
        nextEndDate="2026-04-30"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set end' }));

    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_start_date: '2026-04-24',
        actual_end_date: '2026-04-30',
        duration_days: 7,
      });
    });
  });

  it('cho phép nhập tạm Đến ngày nhỏ hơn Từ ngày khi đang sửa và chỉ cảnh báo khi blur', async () => {
    const onNotify = vi.fn();
    render(
      <HookHarness
        step={makeStep({ actual_start_date: '2026-04-24' })}
        nextEndDate="2026-04-20"
        onNotify={onNotify}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set end' }));

    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_start_date: '2026-04-24',
        actual_end_date: '2026-04-20',
        duration_days: 0,
      });
    });
    expect(onNotify).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Blur end' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'warning',
        'Ngày chưa hợp lệ',
        'Đến ngày phải lớn hơn hoặc bằng Từ ngày.',
      );
    });
  });

  it('cho phép nhập tạm Từ ngày lớn hơn Đến ngày hiện hữu và chỉ cảnh báo khi blur', async () => {
    const onNotify = vi.fn();
    render(
      <HookHarness
        step={makeStep({ actual_start_date: '2026-04-24', duration_days: 7 })}
        nextStartDate="2026-05-01"
        onNotify={onNotify}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set start' }));

    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_start_date: '2026-05-01',
        actual_end_date: '2026-04-30',
        duration_days: 0,
      });
    });
    expect(onNotify).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Blur start' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'warning',
        'Ngày chưa hợp lệ',
        'Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.',
      );
    });
  });

  it('chặn lưu khi range ngày vẫn sai', async () => {
    const onNotify = vi.fn();
    render(
      <HookHarness
        step={makeStep({ actual_start_date: '2026-04-24' })}
        nextEndDate="2026-04-20"
        onNotify={onNotify}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set end' }));
    await waitFor(() => {
      const drafts = JSON.parse(screen.getByTestId('drafts').textContent || '{}');
      expect(drafts['1001']).toMatchObject({
        actual_end_date: '2026-04-20',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'warning',
        'Ngày chưa hợp lệ',
        'Đến ngày phải lớn hơn hoặc bằng Từ ngày.',
      );
    });
  });
});
