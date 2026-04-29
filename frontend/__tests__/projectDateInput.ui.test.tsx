// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  buildProjectDateDisplayDraft,
  ProjectDateInput,
} from '../components/project/ProjectDateInput';

describe('ProjectDateInput helpers', () => {
  it('blocks five-digit years before they reach project state', () => {
    const draft = buildProjectDateDisplayDraft('24/04/20266', '24/04/2026');

    expect(draft.accepted).toBe(false);
    expect(draft.displayValue).toBe('24/04/2026');
    expect(draft.isoValue).toBeNull();
  });

  it('enforces project year range from 2025 to 2999', () => {
    expect(buildProjectDateDisplayDraft('24/04/2024').accepted).toBe(false);
    expect(buildProjectDateDisplayDraft('01/01/2025').isoValue).toBe('2025-01-01');
    expect(buildProjectDateDisplayDraft('31/12/2999').isoValue).toBe('2999-12-31');
    expect(buildProjectDateDisplayDraft('01/01/3000').accepted).toBe(false);
  });

  it('blocks impossible day and month segments', () => {
    expect(buildProjectDateDisplayDraft('00/04/2026').accepted).toBe(false);
    expect(buildProjectDateDisplayDraft('32/04/2026').accepted).toBe(false);
    expect(buildProjectDateDisplayDraft('24/13/2026').accepted).toBe(false);
  });

  it('validates real calendar days including leap years', () => {
    expect(buildProjectDateDisplayDraft('31/04/2026').accepted).toBe(false);
    expect(buildProjectDateDisplayDraft('30/04/2026').isoValue).toBe('2026-04-30');
    expect(buildProjectDateDisplayDraft('29/02/2025').accepted).toBe(false);
    expect(buildProjectDateDisplayDraft('29/02/2028').isoValue).toBe('2028-02-29');
  });
});

describe('ProjectDateInput UI', () => {
  it('shows dd/mm/yyyy text while emitting ISO values only after a complete valid date', () => {
    const onChange = vi.fn();
    render(<ProjectDateInput value="" onChange={onChange} ariaLabel="Từ ngày" testId="project-date" />);

    const input = screen.getByTestId('project-date') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'text');
    expect(input.inputMode).toBe('numeric');
    expect(input).toHaveAttribute('placeholder', 'dd/mm/yyyy');

    fireEvent.change(input, { target: { value: '24/04/202' } });

    expect(input).toHaveValue('24/04/202');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '24/04/2026' } });

    expect(input).toHaveValue('24/04/2026');
    expect(onChange).toHaveBeenCalledWith('2026-04-24');
  });

  it('keeps the previous display and does not emit ISO when a fifth year digit is typed', () => {
    const onChange = vi.fn();
    render(<ProjectDateInput value="2026-04-24" onChange={onChange} ariaLabel="Từ ngày" testId="project-date" />);

    const input = screen.getByTestId('project-date') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '24/04/20266' } });

    expect(input).toHaveValue('24/04/2026');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the calendar picker bounded by project min and max dates', () => {
    const onChange = vi.fn();
    render(<ProjectDateInput value="" onChange={onChange} ariaLabel="Đến ngày" testId="project-date" />);

    const visibleInput = screen.getByTestId('project-date') as HTMLInputElement;
    const nativeInput = screen.getByTestId('project-date-native') as HTMLInputElement;

    expect(nativeInput).toHaveAttribute('type', 'date');
    expect(nativeInput).toHaveAttribute('min', '2025-01-01');
    expect(nativeInput).toHaveAttribute('max', '2999-12-31');

    fireEvent.change(nativeInput, { target: { value: '2026-04-30' } });

    expect(visibleInput).toHaveValue('30/04/2026');
    expect(onChange).toHaveBeenCalledWith('2026-04-30');
  });
});
