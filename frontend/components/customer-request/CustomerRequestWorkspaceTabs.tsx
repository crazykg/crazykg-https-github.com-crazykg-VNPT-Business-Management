import React from 'react';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

export type WorkspaceTabKey = 'overview' | 'creator' | 'dispatcher' | 'performer';

type CustomerRequestWorkspaceTabsProps = {
  activeTab: WorkspaceTabKey;
  onTabChange: (tab: WorkspaceTabKey) => void;
  overviewActionCount: number;
  creatorActionCount: number;
  dispatcherActionCount: number;
  performerActionCount: number;
  overviewWorkspace?: React.ReactNode;
  creatorWorkspace?: React.ReactNode;
  dispatcherWorkspace?: React.ReactNode;
  performerWorkspace?: React.ReactNode;
  toolbar?: React.ReactNode;
  showPanels?: boolean;
  showTabs?: boolean;
  chromeMode?: 'card' | 'inline';
};

type WorkspaceTabMeta = {
  key: WorkspaceTabKey;
  label: string;
  icon: string;
  activeClass: string;
  inactiveAccentClass: string;
  badgeClass: string;
  activeBadgeClass: string;
};

const WORKSPACE_TAB_META: WorkspaceTabMeta[] = [
  {
    key: 'overview',
    label: 'Bảng theo dõi',
    icon: 'space_dashboard',
    activeClass:
      'border-slate-300 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1))] text-slate-800 shadow-sm',
    inactiveAccentClass: 'bg-slate-100 text-slate-500',
    badgeClass: 'bg-slate-100 text-slate-700',
    activeBadgeClass: 'border border-slate-200 bg-white text-slate-700',
  },
  {
    key: 'creator',
    label: 'Người tạo',
    icon: 'person_add',
    activeClass:
      'border-secondary-fixed bg-[linear-gradient(135deg,rgba(224,242,254,0.84),rgba(255,255,255,1))] text-primary shadow-sm',
    inactiveAccentClass: 'bg-secondary-fixed/30 text-primary',
    badgeClass: 'bg-secondary-fixed/40 text-primary',
    activeBadgeClass: 'border border-secondary-fixed bg-white text-primary',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối',
    icon: 'manage_accounts',
    activeClass:
      'border-tertiary-fixed bg-[linear-gradient(135deg,rgba(254,243,199,0.76),rgba(255,255,255,1))] text-tertiary shadow-sm',
    inactiveAccentClass: 'bg-tertiary-fixed/35 text-tertiary',
    badgeClass: 'bg-tertiary-fixed/40 text-tertiary',
    activeBadgeClass: 'border border-tertiary-fixed bg-white text-tertiary',
  },
  {
    key: 'performer',
    label: 'Người xử lý',
    icon: 'engineering',
    activeClass:
      'border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(255,255,255,1))] text-emerald-800 shadow-sm',
    inactiveAccentClass: 'bg-emerald-100 text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    activeBadgeClass: 'border border-emerald-200 bg-white text-emerald-700',
  },
];

const badgeCounts: Record<WorkspaceTabKey, (props: CustomerRequestWorkspaceTabsProps) => number> = {
  overview: (p) => p.overviewActionCount,
  creator: (p) => p.creatorActionCount,
  dispatcher: (p) => p.dispatcherActionCount,
  performer: (p) => p.performerActionCount,
};

export const CustomerRequestWorkspaceTabs: React.FC<CustomerRequestWorkspaceTabsProps> = (props) => {
  const {
    activeTab,
    onTabChange,
    overviewWorkspace,
    creatorWorkspace,
    dispatcherWorkspace,
    performerWorkspace,
    toolbar,
    showPanels = true,
    showTabs = true,
  } = props;
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isMobile = layoutMode === 'mobile';
  const chromeMode = props.chromeMode ?? 'card';
  const chromeWrapperClass =
    chromeMode === 'card'
      ? 'sticky top-0 z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur-sm'
      : 'min-w-0';
  const panelNodes = (
    <>
      {activeTab === 'overview' ? overviewWorkspace : null}
      {activeTab === 'creator' ? creatorWorkspace : null}
      {activeTab === 'dispatcher' ? dispatcherWorkspace : null}
      {activeTab === 'performer' ? performerWorkspace : null}
    </>
  );

  return (
    <div className={showPanels ? 'flex flex-col gap-2' : 'min-w-0'}>
      <div className={chromeWrapperClass}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          {showTabs ? (
            <div className={`grid min-w-0 flex-1 gap-2 ${isMobile ? 'grid-cols-2' : 'md:grid-cols-4'}`}>
              {WORKSPACE_TAB_META.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = badgeCounts[tab.key](props);

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={`group inline-flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-200 ${
                      isActive
                        ? tab.activeClass
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isActive ? 'bg-white text-current shadow-sm' : tab.inactiveAccentClass
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        {tab.icon}
                      </span>
                    </span>

                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold leading-4">{tab.label}</span>
                      {count > 0 ? (
                        <span
                          className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                            isActive ? tab.activeBadgeClass : tab.badgeClass
                          }`}
                        >
                          {count}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {toolbar ? (
            <div className={`min-w-0 ${showTabs ? 'flex-1 lg:max-w-none' : 'w-full flex-1'}`}>
              {toolbar}
            </div>
          ) : null}
        </div>
      </div>

      {showPanels ? panelNodes : null}
    </div>
  );
};
