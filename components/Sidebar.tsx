
import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', icon: 'dashboard', label: 'Bảng điều khiển' },
    { id: 'departments', icon: 'corporate_fare', label: 'Phòng ban' },
    { id: 'businesses', icon: 'category', label: 'Lĩnh vực Kinh doanh' },
    { id: 'vendors', icon: 'storefront', label: 'Đối tác' },
    { id: 'employees', icon: 'badge', label: 'Nhân sự Nội bộ' },
    { id: 'clients', icon: 'handshake', label: 'Khách hàng' },
    { id: 'cus_personnel', icon: 'contact_phone', label: 'Nhân sự liên hệ' },
    { id: 'products', icon: 'inventory_2', label: 'Sản phẩm' },
    { id: 'opportunities', icon: 'lightbulb', label: 'Cơ hội kinh doanh' },
    { id: 'projects', icon: 'topic', label: 'Quản lý Dự án' },
    { id: 'contracts', icon: 'description', label: 'Quản lý Hợp đồng' },
    { id: 'documents', icon: 'folder_open', label: 'Hồ sơ tài liệu' },
    { id: 'reminders', icon: 'notifications', label: 'Nhắc việc' },
    { id: 'docs', icon: 'description', label: 'Tài liệu' },
  ];

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

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
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-primary shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined">business</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">VNPT Business</h1>
              <p className="text-xs text-slate-500 font-medium">Hệ thống quản lý</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-2">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-secondary/20 text-deep-teal font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={`material-symbols-outlined ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-200">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
            <div 
              className="w-9 h-9 rounded-full bg-slate-300 bg-cover bg-center border border-white shadow-sm"
              style={{ backgroundImage: 'url("https://picsum.photos/100/100")' }}
            ></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Admin User</p>
              <p className="text-xs text-slate-500 truncate">admin@vnpt.vn</p>
            </div>
            <span className="material-symbols-outlined text-slate-400">logout</span>
          </div>
        </div>
      </aside>
    </>
  );
};
