
import React from 'react';
import { motion } from 'motion/react';

interface DashboardProps {
  stats: {
    totalCustomers: number;
    activeProjects: number;
    totalContracts: number;
    todayReminders: number;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  return (
    <div className="p-4 md:p-8 animate-fade-in">
      {/* Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-deep-teal to-primary p-8 rounded-3xl text-white shadow-xl shadow-primary/20 mb-8 relative overflow-hidden"
      >
        <div className="relative z-10">
          <h1 className="text-2xl md:text-4xl font-black mb-4 tracking-tight">
            Xin chúc mừng!
          </h1>
          <p className="text-lg md:text-xl font-medium opacity-90 max-w-2xl leading-relaxed">
            Hệ thống đã hoàn thành 100% việc lên kịch bản và thiết kế cho TẤT CẢ các bảng trong cơ sở dữ liệu v9.1.
          </p>
        </div>
        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          title="Tổng Khách hàng" 
          value={stats.totalCustomers} 
          icon="handshake" 
          color="bg-blue-500" 
          delay={0.1}
        />
        <SummaryCard 
          title="Dự án đang chạy" 
          value={stats.activeProjects} 
          icon="rocket_launch" 
          color="bg-emerald-500" 
          delay={0.2}
        />
        <SummaryCard 
          title="Tổng Hợp đồng" 
          value={stats.totalContracts} 
          icon="description" 
          color="bg-amber-500" 
          delay={0.3}
        />
        <SummaryCard 
          title="Nhắc việc hôm nay" 
          value={stats.todayReminders} 
          icon="notifications_active" 
          color="bg-rose-500" 
          delay={0.4}
        />
      </div>

      {/* Quick Access / Recent Activity Placeholder */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">trending_up</span>
            Hoạt động gần đây
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Cập nhật trạng thái dự án HIS</p>
                  <p className="text-xs text-slate-500">Bởi Admin • 2 giờ trước</p>
                </div>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">Dự án</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">calendar_today</span>
            Sắp tới
          </h3>
          <div className="space-y-4">
             <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Ngày mai</p>
                <p className="text-sm font-bold text-slate-900">Họp giao ban tuần</p>
                <p className="text-xs text-slate-500">09:00 - 10:30</p>
             </div>
             <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">22/02/2026</p>
                <p className="text-sm font-bold text-slate-900">Hết hạn hợp đồng VNPT-01</p>
                <p className="text-xs text-slate-500">Cần liên hệ gia hạn</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SummaryCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  delay: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay }}
    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${color} shadow-lg shadow-current/10`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
    </div>
    <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
    <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
  </motion.div>
);
