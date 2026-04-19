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
  it('keeps labeled surface buttons visible on mobile while keeping actions clickable', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    const onSurfaceChange = vi.fn();

    render(
      <CustomerRequestSurfaceSwitch
        activeSurface={'inbox' satisfies CustomerRequestSurfaceKey}
        onSurfaceChange={onSurfaceChange}
      />
    );

    const inboxButton = screen.getByRole('button', { name: /Bảng theo dõi/i });
    const listButton = screen.getByRole('button', { name: /Danh sách/i });

    expect(screen.queryByText('Tra cứu chi tiết')).not.toBeInTheDocument();
    expect(screen.queryByText('Số liệu & điểm nóng')).not.toBeInTheDocument();
    expect(inboxButton.parentElement?.className).toContain('grid-cols-3');
    expect(listButton).toHaveTextContent('Danh sách');
    expect(listButton.className).toContain('min-h-11');
    expect(listButton.className).toContain('w-full');

    await user.click(listButton);
    expect(onSurfaceChange).toHaveBeenCalledWith('list');
  });

  it('keeps the desktop switch free of helper subtitles', async () => {
    setViewportWidth(1600);
    const user = userEvent.setup();
    const onSurfaceChange = vi.fn();

    render(
      <CustomerRequestSurfaceSwitch
        activeSurface={'list' satisfies CustomerRequestSurfaceKey}
        onSurfaceChange={onSurfaceChange}
      />
    );

    const analyticsButton = screen.getByRole('button', { name: /Phân tích/i });

    expect(screen.queryByText('Tra cứu chi tiết')).not.toBeInTheDocument();
    expect(screen.queryByText('Số liệu & điểm nóng')).not.toBeInTheDocument();
    expect(analyticsButton.className).toContain('w-full');
    expect(analyticsButton.parentElement?.className).toContain('grid-cols-3');

    await user.click(analyticsButton);
    expect(onSurfaceChange).toHaveBeenCalledWith('analytics');
  });

  it.each([375, 768, 1024])(
    'renders icon-only compact tabs when explicitly enabled at %ipx',
    async (width) => {
      setViewportWidth(width);
      const user = userEvent.setup();
      const onSurfaceChange = vi.fn();

      render(
        <CustomerRequestSurfaceSwitch
          activeSurface={'inbox' satisfies CustomerRequestSurfaceKey}
          onSurfaceChange={onSurfaceChange}
          iconOnlyOnCompact
        />
      );

      const inboxButton = screen.getByRole('button', { name: /Bảng theo dõi/i });
      const listButton = screen.getByRole('button', { name: /Danh sách/i });

      expect(inboxButton.parentElement?.className).toContain('grid-cols-3');
      expect(listButton.className).toContain('h-11');
      expect(listButton.className).toContain('w-full');
      expect(listButton.className).not.toContain('min-h-11');

      await user.click(listButton);
      expect(onSurfaceChange).toHaveBeenCalledWith('list');
    }
  );

  it.each([1366, 1440, 1600])(
    'keeps labeled pill tabs on desktop widths even when compact mode is enabled (%ipx)',
    async (width) => {
      setViewportWidth(width);
      const user = userEvent.setup();
      const onSurfaceChange = vi.fn();

      render(
        <CustomerRequestSurfaceSwitch
          activeSurface={'list' satisfies CustomerRequestSurfaceKey}
          onSurfaceChange={onSurfaceChange}
          iconOnlyOnCompact
        />
      );

      const analyticsButton = screen.getByRole('button', { name: /Phân tích/i });

      expect(analyticsButton).toHaveTextContent('Phân tích');
      expect(analyticsButton.className).toContain('w-full');
      expect(analyticsButton.parentElement?.className).toContain('grid-cols-3');

      await user.click(analyticsButton);
      expect(onSurfaceChange).toHaveBeenCalledWith('analytics');
    }
  );
});
