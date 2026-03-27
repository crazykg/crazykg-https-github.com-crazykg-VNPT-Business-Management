import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { AppWithRouter } from '../AppWithRouter';
import { LoginPage } from '../components/LoginPage';
import { ProtectedRoute } from './ProtectedRoute';

/**
 * Route configuration for react-router-dom v6.
 *
 * Note: This file documents the current routing approach.
 * Currently, all pages are rendered within AppWithRouter using conditional rendering
 * while URL sync is handled via useLocation/useNavigate hooks in App.tsx.
 *
 * The dummy catch-all route here exists solely to provide a valid Route tree
 * for the BrowserRouter to process while App.tsx manages internal component selection.
 */
export const createRouteObjects = (): RouteObject[] => [
  {
    path: '*',
    element: <AppWithRouter />,
  },
];

/**
 * Route path patterns for reference:
 * - /dashboard
 * - /departments
 * - /user-dept-history
 * - /businesses
 * - /vendors
 * - /products
 * - /clients
 * - /cus-personnel
 * - /opportunities
 * - /projects
 * - /contracts
 * - /documents
 * - /reminders
 * - /customer-request-management
 * - /support-master-management
 * - /procedure-template-config
 * - /department-weekly-schedule-management
 * - /audit-logs
 * - /user-feedback
 * - /integration-settings
 * - /access-control
 */