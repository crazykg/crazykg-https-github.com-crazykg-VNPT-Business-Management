import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CustomerRequestSurfaceSwitch,
  type CustomerRequestSurfaceKey,
} from '../components/customer-request/CustomerRequestSurfaceSwitch';

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('CustomerRequestSurfaceSwitch UI', () => {
  it('hides subtitles on mobile while keeping actions clickable', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    const onSurfaceChange = vi.fn();

    render(
      <CustomerRequestSurfaceSwitch
        activeSurface={'inbox' satisfies CustomerRequestSurfaceKey}
        onSurfaceChange={onSurfaceChange}
      />
    );

    expect(screen.queryByText('Tra cứu chi tiết')).not.toBeInTheDocument();
    expect(screen.queryByText('Số liệu & điểm nóng')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Danh sách/i }));
    expect(onSurfaceChange).toHaveBeenCalledWith('list');
  });

  it('shows subtitles on desktop', () => {
    setViewportWidth(1600);

    render(
      <CustomerRequestSurfaceSwitch
        activeSurface={'list' satisfies CustomerRequestSurfaceKey}
        onSurfaceChange={vi.fn()}
      />
    );

    expect(screen.getByText('Tra cứu chi tiết')).toBeInTheDocument();
    expect(screen.getByText('Số liệu & điểm nóng')).toBeInTheDocument();
  });
});
