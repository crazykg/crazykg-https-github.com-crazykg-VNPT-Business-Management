import React, { useEffect, useMemo, useRef, useState } from 'react';
import { updateCurrentUserAvatar } from '../services/api/legacy';
import { useAuthStore } from '../shared/stores';
import { AuthUser } from '../types';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  visibleTabIds: Set<string>;
  onLogout: () => void;
  onPrefetchTab?: (tab: string) => void;
}

const resolveUserInitials = (user: AuthUser | null): string => {
  const fullName = String(user?.full_name || '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    return `${nameParts[0][0] ?? ''}${nameParts[nameParts.length - 1][0] ?? ''}`.toUpperCase();
  }
  if (nameParts.length === 1) {
    return (nameParts[0].slice(0, 2) || '?').toUpperCase();
  }

  const fallbackSeed = String(user?.username || user?.email || '?').trim();
  return (fallbackSeed.slice(0, 2) || '?').toUpperCase();
};

const normalizeAvatarUrl = (value: unknown): string => String(value ?? '').trim();

export const Sidebar: React.FC<SidebarProps> = React.memo(function SidebarComponent({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  currentUser,
  visibleTabIds,
  onLogout,
  onPrefetchTab,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['org', 'cat', 'crm', 'core', 'legal', 'finance', 'util']);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarStatusMessage, setAvatarStatusMessage] = useState('');
  const [avatarStatusTone, setAvatarStatusTone] = useState<'neutral' | 'error'>('neutral');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(() => normalizeAvatarUrl(currentUser?.avatar_data_url));
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const userInitials = useMemo(() => resolveUserInitials(currentUser), [currentUser]);
  const avatarUrl = avatarPreviewUrl;
  const displayName = currentUser?.full_name || 'Người dùng';

  useEffect(() => {
    setAvatarPreviewUrl(normalizeAvatarUrl(currentUser?.avatar_data_url));
  }, [currentUser?.avatar_data_url]);

  const menuGroups: MenuGroup[] = [
    {
      id: 'org',
      label: 'Tổ chức & Nhân sự',
      icon: 'corporate_fare',
      items: [
        { id: 'departments', icon: 'account_tree', label: 'Phòng ban' },
        { id: 'internal_user_dashboard', icon: 'monitoring', label: 'Dashboard nhân sự' },
        { id: 'user_dept_history', icon: 'history', label: 'Lịch sử luân chuyển' },
      ]
    },
    {
      id: 'cat',
      label: 'Danh mục & Sản phẩm',
      icon: 'grid_view',
      items: [
        { id: 'businesses', icon: 'category', label: 'Lĩnh vực kinh doanh' },
        { id: 'vendors', icon: 'storefront', label: 'Đối tác/Nhà cung cấp' },
        { id: 'products', icon: 'inventory_2', label: 'Sản phẩm/Dịch vụ' },
        { id: 'product_packages', icon: 'inventory', label: 'Gói sản phẩm' },
      ]
    },
    {
      id: 'crm',
      label: 'Khách hàng & CRM',
      icon: 'handshake',
      items: [
        { id: 'clients', icon: 'groups', label: 'Khách hàng' },
        { id: 'cus_personnel', icon: 'contact_phone', label: 'Đầu mối liên hệ' },
      ]
    },
    {
      id: 'core',
      label: 'Thực thi (Core)',
      icon: 'rocket_launch',
      items: [
        { id: 'projects', icon: 'topic', label: 'Quản lý Dự án' },
      ]
    },
    {
      id: 'legal',
      label: 'Pháp lý & Lưu trữ',
      icon: 'description',
      items: [
        { id: 'contracts', icon: 'contract', label: 'Hợp đồng' },
        { id: 'documents', icon: 'folder_open', label: 'Hồ sơ tài liệu' },
      ]
    },
    {
      id: 'finance',
      label: 'Tài chính & Doanh thu',
      icon: 'payments',
      items: [
        { id: 'revenue_mgmt', icon: 'bar_chart', label: 'Quản trị Doanh thu' },
        { id: 'fee_collection', icon: 'receipt_long', label: 'Thu cước' },
      ]
    },
    {
      id: 'util',
      label: 'Tiện ích',
      icon: 'widgets',
      items: [
        { id: 'reminders', icon: 'notifications', label: 'Nhắc việc' },
        { id: 'department_weekly_schedule_management', icon: 'calendar_month', label: 'Lịch làm việc đơn vị' },
        { id: 'customer_request_management', icon: 'schema', label: 'Quản lý yêu cầu KH' },
        { id: 'workflow_mgmt', icon: 'flowchart', label: 'Quản lý Luồng công việc' },
        { id: 'support_master_management', icon: 'tune', label: 'Quản lý danh mục' },
        { id: 'procedure_template_config', icon: 'checklist', label: 'Cấu hình thủ tục DA' },
        { id: 'audit_logs', icon: 'history_toggle_off', label: 'Lịch sử hệ thống' },
        { id: 'user_feedback', icon: 'feedback', label: 'Góp ý người dùng' },
        { id: 'integration_settings', icon: 'settings', label: 'Cấu hình tích hợp' },
        { id: 'access_control', icon: 'manage_accounts', label: 'Phân quyền người dùng' },
      ]
    }
  ];

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const handleItemPrefetch = (id: string) => {
    onPrefetchTab?.(id);
  };

  const toggleGroup = (groupId: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      if (!expandedGroups.includes(groupId)) {
        setExpandedGroups([...expandedGroups, groupId]);
      }
      return;
    }
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId) 
        : [...prev, groupId]
    );
  };

  const handleOpenAvatarPicker = () => {
    if (isUploadingAvatar) {
      return;
    }

    avatarInputRef.current?.click();
  };

  const handleAvatarSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarStatusTone('error');
      setAvatarStatusMessage('Chỉ hỗ trợ tải lên tệp ảnh.');
      return;
    }

    if (file.size > 1024 * 1024) {
      setAvatarStatusTone('error');
      setAvatarStatusMessage('Ảnh đại diện phải nhỏ hơn 1 MB.');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarStatusTone('neutral');
    setAvatarStatusMessage('');

    try {
      const updatedUser = await updateCurrentUserAvatar(file);
      const mergedUser = currentUser ? { ...currentUser, ...updatedUser } : updatedUser;
      setAvatarPreviewUrl(normalizeAvatarUrl(updatedUser.avatar_data_url));
      setAuthUser(mergedUser);
      setAvatarStatusTone('neutral');
      setAvatarStatusMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật ảnh đại diện.';
      setAvatarStatusTone('error');
      setAvatarStatusMessage(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const canViewDashboard = visibleTabIds.has('dashboard');

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar Content */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-20' : 'w-64 xl:w-72'}`}
      >
        {/* Header */}
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white bg-primary shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined">business</span>
            </div>
            {!isCollapsed && (
              <div className="animate-fade-in">
                <h1 className="text-base font-bold text-slate-900 leading-tight truncate">VNPT Business</h1>
                <p className="text-xs text-slate-500 font-medium">Hệ thống quản lý</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => window.innerWidth < 1024 ? onClose() : setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined">
              {window.innerWidth < 1024 ? 'close' : isCollapsed ? 'menu_open' : 'menu'}
            </span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2 scrollbar-hide">
          {/* Dashboard Item */}
          {canViewDashboard && (
            <button
              onClick={() => handleItemClick('dashboard')}
              onMouseEnter={() => handleItemPrefetch('dashboard')}
              onFocus={() => handleItemPrefetch('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-white font-semibold shadow-md shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`material-symbols-outlined ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                dashboard
              </span>
              {!isCollapsed && <span className="text-sm animate-fade-in">Bảng điều khiển</span>}
            </button>
          )}

          {menuGroups.map((group) => {
            const visibleItems = group.items.filter((item) => visibleTabIds.has(item.id));
            if (visibleItems.length === 0) {
              return null;
            }
            const isExpanded = expandedGroups.includes(group.id);
            return (
              <div key={group.id} className="space-y-1">
                {!isCollapsed ? (
                  <button 
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                       <span className="material-symbols-outlined text-sm">{group.icon}</span>
                       <span>{group.label}</span>
                    </div>
                    <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                ) : (
                  <div className="h-px bg-slate-100 my-2 mx-2"></div>
                )}

                {(isExpanded || isCollapsed) && (
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const isActive = activeTab === item.id || (
                        item.id === 'internal_user_dashboard'
                        && (activeTab === 'internal_user_list' || activeTab === 'internal_user_party_members')
                      );
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          onMouseEnter={() => handleItemPrefetch(item.id)}
                          onFocus={() => handleItemPrefetch(item.id)}
                          title={isCollapsed ? item.label : ''}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                            isActive
                              ? 'bg-secondary/20 text-deep-teal font-semibold'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <span className={`material-symbols-outlined ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            {item.icon}
                          </span>
                          {!isCollapsed && <span className="text-sm animate-fade-in truncate">{item.label}</span>}
                          {isCollapsed && isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 mt-auto border-t border-slate-200">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            aria-label="Chọn ảnh đại diện"
            onChange={handleAvatarSelection}
          />
          <div className={`flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
            <button
              type="button"
              onClick={handleOpenAvatarPicker}
              disabled={isUploadingAvatar}
              className="relative flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
              aria-label="Cập nhật ảnh đại diện"
              title="Cập nhật ảnh đại diện"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`Ảnh đại diện ${displayName}`}
                  className="w-11 h-11 rounded-full object-cover border border-white shadow-sm"
                />
              ) : (
                <div className="w-11 h-11 rounded-full border border-white shadow-sm bg-gradient-to-br from-primary to-deep-teal text-white flex items-center justify-center text-sm font-bold">
                  {userInitials}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-white text-slate-500 shadow-sm">
                <span className={`material-symbols-outlined text-[15px] ${isUploadingAvatar ? 'animate-spin' : ''}`}>
                  {isUploadingAvatar ? 'progress_activity' : 'photo_camera'}
                </span>
              </span>
            </button>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.email || '-'}</p>
                {avatarStatusMessage && avatarStatusTone === 'error' ? (
                  <p className="mt-1 text-[11px] text-red-500">{avatarStatusMessage}</p>
                ) : null}
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-white transition-colors"
              title="Đăng xuất"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
});
