import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { AppWithRouter } from '../AppWithRouter';
import { LoginPage } from '../components/LoginPage';
import { ProtectedRoute } from './ProtectedRoute';

/**
 * Route configuration for react-router-dom v6.
 * 
 * Note: This is a placeholder for future route-based code splitting.
 * Currently, all pages are rendered within AppWithRouter using conditional rendering
 * while URL sync is handled via hooks.
 */
export const createRouteObjects = (): RouteObject[] => [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute user={null} isLoading={false}>
        <AppWithRouter />
      </ProtectedRoute>
    ),
    children: [
      // All app routes are handled internally by AppWithRouter
      // This allows preserving existing data loading patterns
      { path: '*', element: null },
    ],
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