import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../App', async () => {
  const ReactModule = await import('react');
  const { useQueryClient } = await import('@tanstack/react-query');

  return {
    default: () => {
      const client = useQueryClient();

      return ReactModule.createElement(
        'div',
        null,
        client ? 'Query client ready' : 'Missing query client',
      );
    },
  };
});

import { AppWithRouter } from '../AppWithRouter';

describe('AppWithRouter', () => {
  it('provides a TanStack Query client to the routed app shell', () => {
    window.history.pushState({}, '', '/');
    render(<AppWithRouter />);

    expect(screen.getByText('Query client ready')).toBeInTheDocument();
  });
});
