import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { queryClient } from './shared/queryClient';

/**
 * Main router wrapper component.
 * 
 * This component wraps the existing App component with react-router-dom's
 * BrowserRouter, enabling URL-based navigation while preserving all existing
 * data loading and state management patterns.
 * 
 * The App component handles:
 * - Auth state management internally
 * - Data loading for all modules
 * - Conditional page rendering based on activeTab state
 * - URL sync via useNavigate/useLocation hooks (to be added)
 */
export const AppWithRouter: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
};
