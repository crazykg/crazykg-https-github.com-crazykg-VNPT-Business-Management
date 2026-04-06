import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { canAccessTab } from '../utils/authorization';
import type { AuthUser } from '../types';

const AVAILABLE_TABS = [
  'dashboard',
  'internal_user_dashboard',
  'internal_user_list',
  'departments',
  'user_dept_history',
  'businesses',
  'vendors',
  'products',
  'clients',
  'cus_personnel',
  'projects',
  'contracts',
  'documents',
  'reminders',
  'customer_request_management',
  'revenue_mgmt',
  'fee_collection',
  'support_master_management',
  'procedure_template_config',
  'department_weekly_schedule_management',
  'audit_logs',
  'user_feedback',
  'integration_settings',
  'access_control',
] as const;

type TabId = typeof AVAILABLE_TABS[number];

const TAB_PATH_MAP: Record<string, string> = {
  dashboard: '/',
  user_dept_history: '/user-dept-history',
  customer_request_management: '/customer-request-management',
  internal_user_dashboard: '/internal-user-dashboard',
  internal_user_list: '/internal-user-list',
};

const PATH_TAB_MAP: Record<string, string> = {
  '': 'dashboard',
  'user-dept-history': 'user_dept_history',
  'customer-request-management': 'customer_request_management',
  'internal-user-dashboard': 'internal_user_dashboard',
  'internal-user-list': 'internal_user_list',
};

interface UseAppNavigationReturn {
  activeTab: TabId;
  internalUserSubTab: 'dashboard' | 'list';
  handleNavigateTab: (tabId: TabId) => void;
  getRoutePathFromTabId: (tabId: TabId) => string;
  getTabIdFromPath: (pathname: string) => TabId | null;
  visibleTabIds: Set<TabId>;
  setInternalUserSubTab: (subTab: 'dashboard' | 'list') => void;
}

export function useAppNavigation(
  authUser: AuthUser | null,
  passwordChangeRequired: boolean
): UseAppNavigationReturn {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [internalUserSubTab, setInternalUserSubTab] = useState<'dashboard' | 'list'>('dashboard');

  const getRoutePathFromTabId = useCallback((tabId: TabId): string => {
    if (tabId === 'dashboard') return '/';
    if (tabId === 'user_dept_history') return '/user-dept-history';
    if (tabId === 'customer_request_management') return '/customer-request-management';
    if (tabId === 'internal_user_dashboard') return '/internal-user-dashboard';
    if (tabId === 'internal_user_list') return '/internal-user-list';
    return `/${tabId.replace(/_/g, '-')}`;
  }, []);

  const getTabIdFromPath = useCallback((pathname: string): TabId | null => {
    const normalizedPath = pathname.replace(/^\/+|\/+$/g, '');
    if (normalizedPath === '') return 'dashboard';

    // Handle special cases
    if (PATH_TAB_MAP[normalizedPath]) return PATH_TAB_MAP[normalizedPath] as TabId;

    const [rootSegment] = normalizedPath.split('/');
    const tabId = (rootSegment || normalizedPath).replace(/-/g, '_');
    return AVAILABLE_TABS.includes(tabId as TabId) ? (tabId as TabId) : 'dashboard';
  }, []);

  const visibleTabIds = new Set<TabId>(
    AVAILABLE_TABS.filter((tabId) => canAccessTab(authUser, tabId))
  );

  // Sync from URL to activeTab
  useEffect(() => {
    const tabFromPath = getTabIdFromPath(location.pathname);
    if (tabFromPath && tabFromPath !== activeTab) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname, getTabIdFromPath, activeTab]);

  const handleNavigateTab = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    navigate(getRoutePathFromTabId(tabId));
  }, [navigate, getRoutePathFromTabId]);

  // Fallback tab logic - redirect to valid tab if current tab is not accessible
  useEffect(() => {
    if (!authUser || passwordChangeRequired) {
      return;
    }

    if (visibleTabIds.has(activeTab)) {
      return;
    }

    const fallbackTab = AVAILABLE_TABS.find((tabId) => visibleTabIds.has(tabId)) || 'dashboard';
    if (fallbackTab !== activeTab) {
      handleNavigateTab(fallbackTab);
    }
  }, [authUser, activeTab, passwordChangeRequired, visibleTabIds, handleNavigateTab]);

  return {
    activeTab,
    internalUserSubTab,
    handleNavigateTab,
    getRoutePathFromTabId,
    getTabIdFromPath,
    visibleTabIds,
    setInternalUserSubTab,
  };
}
