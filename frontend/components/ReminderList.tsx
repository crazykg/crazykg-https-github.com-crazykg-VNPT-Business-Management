
import React, { useState, useMemo } from 'react';
import { Reminder, Employee, ModalType } from '../types';
import { getEmployeeLabel, normalizeEmployeeCode } from '../utils/employeeDisplay';

interface ReminderListProps {
  reminders: Reminder[];
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Reminder) => void;
}

type FilterType = 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE';

export const ReminderList: React.FC<ReminderListProps> = ({ reminders = [], employees = [], onOpenModal }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const getEmployeeName = (id: string) => {
    const employee = (employees || []).find(e => String(e.id) === String(id));
    if (!employee) return normalizeEmployeeCode(id, id);
    return getEmployeeLabel(employee);
  };

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
    <div className="p-3 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>notifications_active</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Nhắc việc</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Theo dõi và quản lý các công việc cần thực hiện.</p>
          </div>
        </div>
        <button onClick={() => onOpenModal('ADD_REMINDER')} className="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container hover:bg-deep-teal transition-all text-white px-2.5 py-1.5 rounded-xl font-semibold text-xs shadow-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_task</span>
          <span>Thêm nhắc việc</span>
        </button>
      </header>

      {/* Filters & Search */}
      <div className="flex gap-3 mb-3">
        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm self-start">
          {(['ALL', 'TODAY', 'UPCOMING', 'OVERDUE'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === f
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-neutral hover:bg-surface-variant'
              }`}
            >
              {f === 'ALL' ? 'Tất cả' : f === 'TODAY' ? 'Hôm nay' : f === 'UPCOMING' ? 'Sắp tới' : 'Quá hạn'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral" style={{ fontSize: 16 }}>search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm nhắc việc..."
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs"
          />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredReminders.length > 0 ? (
          filteredReminders.map((item) => {
            const overdue = isOverdue(item.remindDate);
            return (
              <div key={item.id} className={`rounded-lg border bg-white shadow-sm transition-all hover:shadow-md group ${overdue ? 'border-error/30 bg-error/5' : 'border-slate-200'}`}>
                <div className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className={`w-7 h-7 rounded flex items-center justify-center ${overdue ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>notifications_active</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onOpenModal('EDIT_REMINDER', item)} className="p-1.5 text-neutral hover:text-primary hover:bg-surface-variant rounded-lg transition-all"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span></button>
                      <button onClick={() => onOpenModal('DELETE_REMINDER', item)} className="p-1.5 text-neutral hover:text-error hover:bg-error/10 rounded-lg transition-all"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span></button>
                    </div>
                  </div>

                  <h3 className={`text-sm font-bold mb-1 line-clamp-1 ${overdue ? 'text-error' : 'text-on-surface'}`}>{item.title}</h3>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2 mb-2">{item.content}</p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 14 }}>calendar_today</span>
                      <span className={`font-semibold ${overdue ? 'text-error' : 'text-on-surface-variant'}`}>
                        {item.remindDate} {overdue && '(Quá hạn)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 14 }}>person</span>
                      <span className="text-on-surface-variant">Giao cho: <span className="font-semibold text-on-surface">{getEmployeeName(item.assignedToUserId)}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-neutral bg-white rounded-lg border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-neutral" style={{ fontSize: 48 }}>event_busy</span>
            <p className="text-sm font-semibold mt-3">Không tìm thấy nhắc việc nào.</p>
          </div>
        )}
      </div>
    </div>
  );
};
