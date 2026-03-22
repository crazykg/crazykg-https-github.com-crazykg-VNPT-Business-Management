import React from 'react';

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
};

const WORKSPACE_TAB_META: WorkspaceTabMeta[] = [
  {
    key: 'overview',
    label: 'Tổng quan',
    icon: 'space_dashboard',
    activeClass: 'bg-slate-900 text-white shadow-sm',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  {
    key: 'creator',
    label: 'Người tạo',
    icon: 'person_add',
    activeClass: 'bg-sky-600 text-white shadow-sm',
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối',
    icon: 'manage_accounts',
    activeClass: 'bg-amber-500 text-white shadow-sm',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'performer',
    label: 'Người xử lý',
    icon: 'engineering',
    activeClass: 'bg-emerald-600 text-white shadow-sm',
    badgeClass: 'bg-emerald-100 text-emerald-700',
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

  return (
    <div className="flex flex-col gap-4">
      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
            {WORKSPACE_TAB_META.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = badgeCounts[tab.key](props);

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? tab.activeClass
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  {tab.label}
                  {count > 0 ? (
                    <span
                      className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                        isActive ? 'bg-white/25 text-white' : tab.badgeClass
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
