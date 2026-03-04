
import React, { useState } from 'react';
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

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  currentUser,
  visibleTabIds,
  onLogout,
  onPrefetchTab,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['org', 'cat', 'crm', 'core', 'legal', 'util']);

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
      ]
    },
    {
      id: 'crm',
      label: 'Khách hàng & CRM',
      icon: 'handshake',
      items: [
        { id: 'clients', icon: 'groups', label: 'Khách hàng' },
        { id: 'cus_personnel', icon: 'contact_phone', label: 'Đầu mối liên hệ' },
        { id: 'opportunities', icon: 'lightbulb', label: 'Cơ hội kinh doanh' },
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
      id: 'util',
      label: 'Tiện ích',
      icon: 'widgets',
      items: [
        { id: 'reminders', icon: 'notifications', label: 'Nhắc việc' },
        { id: 'customer_request_management', icon: 'schema', label: 'Quản lý yêu cầu KH' },
        { id: 'support_requests', icon: 'support_agent', label: 'Yêu cầu hỗ trợ' },
        { id: 'support_master_management', icon: 'tune', label: 'Quản lý danh mục hỗ trợ' },
        { id: 'programming_requests', icon: 'terminal', label: 'Yêu cầu lập trình' },
        { id: 'audit_logs', icon: 'history_toggle_off', label: 'Lịch sử hệ thống' },
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
        } ${isCollapsed ? 'w-20' : 'w-72'}`}
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
              onTouchStart={() => handleItemPrefetch('dashboard')}
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
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          onMouseEnter={() => handleItemPrefetch(item.id)}
                          onFocus={() => handleItemPrefetch(item.id)}
                          onTouchStart={() => handleItemPrefetch(item.id)}
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
          <div className={`flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
            <div 
              className="w-9 h-9 rounded-full bg-slate-300 bg-cover bg-center border border-white shadow-sm flex-shrink-0"
              style={{ backgroundImage: 'url("https://picsum.photos/100/100")' }}
            ></div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-sm font-bold text-slate-900 truncate">{currentUser?.full_name || 'Người dùng'}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.email || '-'}</p>
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
};
