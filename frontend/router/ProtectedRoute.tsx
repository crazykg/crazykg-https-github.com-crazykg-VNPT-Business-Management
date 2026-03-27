import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AuthUser } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  user: AuthUser | null;
  isLoading: boolean;
}

/**
 * Auth guard component for protected routes.
 *
 * Note: Currently unused in active flow because auth gating is handled
 * manually within App.tsx (rendering LoginPage conditionally).
 * This component is kept as infrastructure for when we transition
 * fully to a Route-based component tree.
 *
 * Redirects to login if user is not authenticated.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  user,
  isLoading,
}) => {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span className="font-semibold">Đang tải...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login, preserving the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};