import { create } from 'zustand';

/**
 * UI store for global UI state: active tab, sidebar, modal type.
 *
 * This will progressively absorb UI-related useState hooks from App.tsx
 * during the feature-driven migration.
 */

interface UiState {
  activeTab: string;
  internalUserSubTab: string;
  sidebarCollapsed: boolean;

  setActiveTab: (tab: string) => void;
  setInternalUserSubTab: (subTab: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'dashboard',
  internalUserSubTab: 'list',
  sidebarCollapsed: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setInternalUserSubTab: (subTab) => set({ internalUserSubTab: subTab }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
