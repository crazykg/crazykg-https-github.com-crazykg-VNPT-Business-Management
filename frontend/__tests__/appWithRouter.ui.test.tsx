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

vi.mock('../components/customer-request/CustomerRequestManagementWireframe', async () => {
  const ReactModule = await import('react');
  return {
    CustomerRequestManagementWireframe: () =>
      ReactModule.createElement('div', null, 'Wireframe preview ready'),
  };
});

import { AppWithRouter } from '../AppWithRouter';

describe('AppWithRouter', () => {
  it('provides a TanStack Query client to the routed app shell', () => {
    window.history.pushState({}, '', '/');
    render(<AppWithRouter />);

    expect(screen.getByText('Query client ready')).toBeInTheDocument();
  });

  it('bypasses the app shell for customer request wireframe preview', () => {
    window.history.pushState({}, '', '/customer-request-management?preview=wireframe');
    render(<AppWithRouter />);

    expect(screen.getByText('Wireframe preview ready')).toBeInTheDocument();
    expect(screen.queryByText('Query client ready')).not.toBeInTheDocument();
  });
});
