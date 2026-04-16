import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SearchableSelect as SharedSearchableSelect } from '../components/SearchableSelect';
import { SearchableMultiSelect as SharedSearchableMultiSelect } from '../components/SearchableMultiSelect';
import {
  SearchableSelect as ModalSearchableSelect,
  SearchableMultiSelect as ModalSearchableMultiSelect,
} from '../components/modals/selectPrimitives';

describe('searchable selects render dropdowns through portal by default', () => {
  const selectOptions = [
    { value: 'all', label: 'Tất cả phòng ban' },
    { value: 'bgdvt', label: 'BGDVT - Ban giám đốc Viễn Thông' },
  ];

  const multiSelectOptions = [
    { value: 'all', label: 'Tất cả phòng ban' },
    { value: 'bgdvt', label: 'BGDVT - Ban giám đốc Viễn Thông' },
  ];

  const renderInsideOverflowShell = (node: React.ReactNode) => {
    render(
      <div data-testid="overflow-shell" className="relative h-24 overflow-hidden">
        {node}
      </div>
    );

    return screen.getByTestId('overflow-shell');
  };

  it('uses a portal for the shared single select', () => {
    const shell = renderInsideOverflowShell(
      <SharedSearchableSelect
        value=""
        options={selectOptions}
        onChange={() => undefined}
        placeholder="Chọn phòng ban"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn phòng ban' }));

    expect(screen.getByText('Tất cả phòng ban')).toBeInTheDocument();
    expect(within(shell).queryByText('Tất cả phòng ban')).not.toBeInTheDocument();
  });

  it('uses a portal for the shared multi select', () => {
    const shell = renderInsideOverflowShell(
      <SharedSearchableMultiSelect
        values={[]}
        options={multiSelectOptions}
        onChange={() => undefined}
        placeholder="Chọn phòng ban"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn phòng ban' }));

    expect(screen.getByText('Tất cả phòng ban')).toBeInTheDocument();
    expect(within(shell).queryByText('Tất cả phòng ban')).not.toBeInTheDocument();
  });

  it('uses a portal for modal single select primitives', () => {
    const shell = renderInsideOverflowShell(
      <ModalSearchableSelect
        value=""
        options={selectOptions}
        onChange={() => undefined}
        placeholder="Chọn người dùng"
      />
    );

    fireEvent.click(screen.getByText('Chọn người dùng'));

    expect(screen.getByText('Tất cả phòng ban')).toBeInTheDocument();
    expect(within(shell).queryByText('Tất cả phòng ban')).not.toBeInTheDocument();
  });

  it('uses a portal for modal multi select primitives', () => {
    const shell = renderInsideOverflowShell(
      <ModalSearchableMultiSelect
        values={[]}
        options={multiSelectOptions}
        onChange={() => undefined}
        placeholder="Chọn nhiều phòng ban"
      />
    );

    fireEvent.click(screen.getByText('Chọn nhiều phòng ban'));

    expect(screen.getByText('Tất cả phòng ban')).toBeInTheDocument();
    expect(within(shell).queryByText('Tất cả phòng ban')).not.toBeInTheDocument();
  });
});
