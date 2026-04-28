import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectFormLayout } from '../components/modals/ProjectFormSections';

describe('ProjectFormLayout tab strip', () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('scrolls the active tab back into view when the modal opens on the info tab', async () => {
    render(
      <ProjectFormLayout
        activeTab="info"
        content={<div>Nội dung</div>}
        disableClose={false}
        isPersistedProject
        isSubmitting={false}
        itemCount={3}
        onClose={() => {}}
        onSubmit={() => {}}
        onTabSwitch={() => {}}
        raciCount={8}
        saveNotice={{ status: 'idle' }}
        type="EDIT"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Thông tin chung' })).toBeInTheDocument();
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'start',
      });
    });
  });
});
