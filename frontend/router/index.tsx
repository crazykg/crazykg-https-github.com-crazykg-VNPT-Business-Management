/**
 * Router module exports for react-router-dom v6 integration.
 * 
 * This module provides routing infrastructure for the VNPT Business Management frontend.
 * The migration preserves existing data loading patterns while enabling:
 * - Deep linking (bookmarkable URLs)
 * - Browser back/forward navigation
 * - URL state synchronization
 */

// Core routing components
export { ProtectedRoute } from './ProtectedRoute';

// Route configuration (for future route-based code splitting)
export { createRouteObjects } from './routes';

// Re-export react-router-dom hooks for convenient access
export {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  Link,
  NavLink,
} from 'react-router-dom';

export type {
  RouteObject,
  NavigateOptions,
  PathRouteProps,
  LayoutRouteProps,
} from 'react-router-dom';