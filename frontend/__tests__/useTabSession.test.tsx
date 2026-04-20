// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTabSession } from '../hooks/useTabSession';

describe('useTabSession', () => {
  it('is a no-op and never calls onEvicted', () => {
    const onEvicted = vi.fn();

    const { rerender, unmount } = renderHook(
      ({ isAuthenticated }) => useTabSession({ isAuthenticated, onEvicted }),
      {
        initialProps: { isAuthenticated: true },
      }
    );

    rerender({ isAuthenticated: false });
    rerender({ isAuthenticated: true });

    expect(onEvicted).not.toHaveBeenCalled();

    unmount();
    expect(onEvicted).not.toHaveBeenCalled();
  });
});
