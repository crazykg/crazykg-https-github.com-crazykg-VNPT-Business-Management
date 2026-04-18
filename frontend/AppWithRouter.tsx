import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { queryClient } from './shared/queryClient';
import { CustomerRequestManagementWireframe } from './components/customer-request/CustomerRequestManagementWireframe';

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
const RouterContent: React.FC = () => {
  const location = useLocation();
  const isCustomerRequestWireframePreview =
    location.pathname === '/customer-request-management'
    && new URLSearchParams(location.search).get('preview') === 'wireframe';

  if (isCustomerRequestWireframePreview) {
    return <CustomerRequestManagementWireframe />;
  }

  return <App />;
};

export const AppWithRouter: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouterContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
};
