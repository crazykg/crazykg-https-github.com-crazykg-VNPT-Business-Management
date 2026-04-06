import React from 'react';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

export type WorkspaceTabKey = 'overview' | 'creator' | 'dispatcher' | 'performer';

type CustomerRequestWorkspaceTabsProps = {
  activeTab: WorkspaceTabKey;
  onTabChange: (tab: WorkspaceTabKey) => void;
  /** Số ca attention trong overview */
  overviewActionCount: number;
  /** Số action items Creator cần xử lý (reviewRows + notifyRows) */
  creatorActionCount: number;
  /** Số action items Dispatcher cần xử lý (queueRows + returnedRows) */
  dispatcherActionCount: number;
  /** Số action items Performer cần xử lý (pendingRows) */
  performerActionCount: number;
  overviewWorkspace?: React.ReactNode;
  creatorWorkspace?: React.ReactNode;
  dispatcherWorkspace?: React.ReactNode;
  performerWorkspace?: React.ReactNode;
  toolbar?: React.ReactNode;
  showPanels?: boolean;
};

type WorkspaceTabMeta = {
  key: WorkspaceTabKey;
  label: string;
  icon: string;
  /** Classes cho nút khi đang ACTIVE */
  activeClass: string;
  /** Classes cho badge khi tab INACTIVE */
  badgeClass: string;
  /** Classes cho badge khi tab ACTIVE */
  activeBadgeClass: string;
};

const WORKSPACE_TAB_META: WorkspaceTabMeta[] = [
  {
    key: 'overview',
    label: 'Tổng quan',
    icon: 'space_dashboard',
    activeClass: 'border border-slate-300 bg-surface-container text-on-surface shadow-sm',
    badgeClass: 'bg-slate-100 text-slate-700',
    activeBadgeClass: 'border border-slate-200 bg-white text-slate-700',
  },
  {
    key: 'creator',
    label: 'Người tạo',
    icon: 'person_add',
    activeClass: 'border border-secondary-fixed bg-secondary-fixed/30 text-primary shadow-sm',
    badgeClass: 'bg-secondary-fixed/40 text-primary',
    activeBadgeClass: 'border border-secondary-fixed bg-white text-primary',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối',
    icon: 'manage_accounts',
    activeClass: 'border border-tertiary-fixed bg-tertiary-fixed/30 text-tertiary shadow-sm',
    badgeClass: 'bg-tertiary-fixed/40 text-tertiary',
    activeBadgeClass: 'border border-tertiary-fixed bg-white text-tertiary',
  },
  {
    key: 'performer',
    label: 'Người xử lý',
    icon: 'engineering',
    activeClass: 'border border-emerald-200 bg-emerald-50/50 text-emerald-800 shadow-sm',
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
  } = props;
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isMobile = layoutMode === 'mobile';

  return (
    <div className={`flex flex-col ${isMobile ? 'gap-3' : 'gap-3'}`}>
      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div
        className={`sticky top-0 z-10 rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm ${
          isMobile ? 'px-3 py-2' : 'px-3 py-2'
        }`}
      >
        <div className={`flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between`}>
          <div className={`flex min-w-0 items-center gap-2 overflow-x-auto pb-0`}>
            {WORKSPACE_TAB_META.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = badgeCounts[tab.key](props);

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={`group inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? tab.activeClass
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {count > 0 ? (
                    <span
                      className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                        isActive ? tab.activeBadgeClass : tab.badgeClass
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {toolbar ? <div className="min-w-0">{toolbar}</div> : null}
        </div>
      </div>

      {/* ── Active workspace content ───────────────────────────────────── */}
      {showPanels ? (
        <>
          {activeTab === 'overview' ? overviewWorkspace : null}
          {activeTab === 'creator' ? creatorWorkspace : null}
          {activeTab === 'dispatcher' ? dispatcherWorkspace : null}
          {activeTab === 'performer' ? performerWorkspace : null}
        </>
      ) : null}
    </div>
  );
};
