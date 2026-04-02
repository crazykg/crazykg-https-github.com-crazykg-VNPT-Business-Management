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
    activeClass: 'border border-slate-300 bg-gradient-to-br from-slate-100 to-slate-50 text-slate-900 shadow-md',
    badgeClass: 'bg-slate-100 text-slate-700',
    activeBadgeClass: 'border border-slate-200 bg-white text-slate-700 shadow-sm',
  },
  {
    key: 'creator',
    label: 'Người tạo',
    icon: 'person_add',
    activeClass: 'border border-sky-300 bg-gradient-to-br from-sky-50 to-sky-100/50 text-sky-800 shadow-md shadow-sky-100',
    badgeClass: 'bg-gradient-to-br from-sky-100 to-sky-50 text-sky-700 shadow-sm',
    activeBadgeClass: 'border border-sky-200 bg-white text-sky-700 shadow-sm',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối',
    icon: 'manage_accounts',
    activeClass: 'border border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-800 shadow-md shadow-amber-100',
    badgeClass: 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 shadow-sm',
    activeBadgeClass: 'border border-amber-200 bg-white text-amber-700 shadow-sm',
  },
  {
    key: 'performer',
    label: 'Người xử lý',
    icon: 'engineering',
    activeClass: 'border border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-800 shadow-md shadow-emerald-100',
    badgeClass: 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 shadow-sm',
    activeBadgeClass: 'border border-emerald-200 bg-white text-emerald-700 shadow-sm',
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
    <div className={`flex flex-col ${isMobile ? 'gap-3' : 'gap-4'}`}>
      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div
        className={`sticky top-0 z-10 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white/95 to-slate-50/80 shadow-lg shadow-slate-200/50 backdrop-blur-xl ${
          isMobile ? 'px-3 py-2.5' : 'px-4 py-3'
        }`}
      >
        <div className={`flex flex-col ${isMobile ? 'gap-2' : 'gap-3'} xl:flex-row xl:items-center xl:justify-between`}>
          <div className={`flex min-w-0 items-center gap-2 overflow-x-auto ${isMobile ? 'pb-0' : 'pb-1'}`}>
            {WORKSPACE_TAB_META.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = badgeCounts[tab.key](props);

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={`group inline-flex shrink-0 items-center gap-2 rounded-xl font-semibold transition-all duration-200 ${
                    isMobile ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm'
                  } ${
                    isActive
                      ? tab.activeClass
                      : 'border border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white hover:shadow-md'
                  }`}
                >
                  <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${
                    isMobile ? 'text-[16px]' : 'text-[18px]'
                  } ${isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {count > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-center font-bold transition-transform group-hover:scale-110 ${
                        isMobile ? 'min-w-[18px] text-[9px]' : 'min-w-[20px] text-[10px]'
                      } ${
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
