import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { PublicProjectProcedurePage } from './components/PublicProjectProcedurePage';
import { queryClient } from './shared/queryClient';

const AppRouteSwitch: React.FC = () => {
  const location = useLocation();

  if (location.pathname === '/public/project-procedure' || location.pathname.startsWith('/public/project-procedure/')) {
    return <PublicProjectProcedurePage />;
  }

  return <App />;
};

export const AppWithRouter: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouteSwitch />
      </BrowserRouter>
    </QueryClientProvider>
  );
};
