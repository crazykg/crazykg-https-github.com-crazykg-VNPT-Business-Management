
import React, { useState, useMemo } from 'react';
import { Reminder, Employee, ModalType } from '../types';

interface ReminderListProps {
  reminders: Reminder[];
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Reminder) => void;
}

type FilterType = 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE';

export const ReminderList: React.FC<ReminderListProps> = ({ reminders = [], employees = [], onOpenModal }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const getEmployeeName = (id: string) => (employees || []).find(e => e.id === id)?.name || id;

  const filteredReminders = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().split('T')[0];

    return (reminders || []).filter(rem => {
      const matchesSearch = rem.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           rem.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesFilter = true;
      if (activeFilter === 'TODAY') {
        matchesFilter = rem.remindDate === todayStr;
      } else if (activeFilter === 'UPCOMING') {
        matchesFilter = rem.remindDate > todayStr;
      } else if (activeFilter === 'OVERDUE') {
        matchesFilter = rem.remindDate < todayStr;
      }

      return matchesSearch && matchesFilter;
    });
  }, [reminders, searchTerm, activeFilter]);

  const isOverdue = (dateStr: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    return date < now;
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Nhắc việc</h2>
          <p className="text-slate-500 text-sm mt-1">Theo dõi và quản lý các công việc cần thực hiện.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onOpenModal('ADD_REMINDER')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
            <span className="material-symbols-outlined">add_task</span>
            <span>Thêm nhắc việc</span>
          </button>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm self-start">
          {(['ALL', 'TODAY', 'UPCOMING', 'OVERDUE'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeFilter === f 
                  ? 'bg-primary text-white shadow-md shadow-primary/20' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f === 'ALL' ? 'Tất cả' : f === 'TODAY' ? 'Hôm nay' : f === 'UPCOMING' ? 'Sắp tới' : 'Quá hạn'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            placeholder="Tìm kiếm nhắc việc..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm shadow-sm" 
          />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {filteredReminders.length > 0 ? (
          filteredReminders.map((item) => {
            const overdue = isOverdue(item.remindDate);
            return (
              <div key={item.id} className={`bg-white rounded-2xl border transition-all hover:shadow-lg group ${overdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                <div className="p-5 md:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-xl ${overdue ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      <span className="material-symbols-outlined">notifications_active</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onOpenModal('EDIT_REMINDER', item)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"><span className="material-symbols-outlined text-lg">edit</span></button>
                      <button onClick={() => onOpenModal('DELETE_REMINDER', item)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </div>
                  </div>
                  
                  <h3 className={`text-base font-bold mb-2 line-clamp-1 ${overdue ? 'text-red-700' : 'text-slate-900'}`}>{item.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">{item.content}</p>
                  
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                      <span className={`font-bold ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                        {item.remindDate} {overdue && '(Quá hạn)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                      <span className="text-slate-600 font-medium">Giao cho: <span className="text-slate-900 font-bold">{getEmployeeName(item.assignedToUserId)}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
            <span className="material-symbols-outlined text-5xl mb-4">event_busy</span>
            <p className="font-medium">Không tìm thấy nhắc việc nào.</p>
          </div>
        )}
      </div>
    </div>
  );
};
