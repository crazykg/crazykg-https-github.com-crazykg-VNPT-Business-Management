
import React, { useState, useMemo } from 'react';
import type { ModalType } from '../types';
import type { Reminder } from '../types/document';
import type { Employee } from '../types/employee';
import { getEmployeeLabel, normalizeEmployeeCode } from '../utils/employeeDisplay';

interface ReminderListProps {
  reminders: Reminder[];
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Reminder) => void;
}

type FilterType = 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE';

export const ReminderList: React.FC<ReminderListProps> = ({ reminders = [], employees = [], onOpenModal }: ReminderListProps) => {
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
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>event_note</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Nhắc việc</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Theo dõi và quản lý các công việc cần thực hiện.</p>
          </div>
        </div>
        <button onClick={() => onOpenModal('ADD_REMINDER')} className="inline-flex items-center gap-1.5 bg-primary hover:bg-deep-teal text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_task</span>
          Thêm nhắc việc
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm self-start">
          {(['ALL', 'TODAY', 'UPCOMING', 'OVERDUE'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                activeFilter === f
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f === 'ALL' ? 'Tất cả' : f === 'TODAY' ? 'Hôm nay' : f === 'UPCOMING' ? 'Sắp tới' : 'Quá hạn'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm nhắc việc..."
            className="w-full pl-8 pr-3 h-8 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none text-xs shadow-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredReminders.length > 0 ? (
          filteredReminders.map((item) => {
            const overdue = isOverdue(item.remindDate);
            return (
              <div key={item.id} className={`bg-white rounded-lg border transition-all hover:shadow-lg group ${overdue ? 'border-error/20 bg-error/5' : 'border-slate-200'}`}>
                <div className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className={`p-1.5 rounded ${overdue ? 'bg-error/10 text-error' : 'bg-secondary/15 text-secondary'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>notifications_active</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onOpenModal('EDIT_REMINDER', item)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition-all"><span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span></button>
                      <button onClick={() => onOpenModal('DELETE_REMINDER', item)} className="p-1.5 text-slate-400 hover:text-error hover:bg-error/10 rounded transition-all"><span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span></button>
                    </div>
                  </div>

                  <h3 className={`text-xs font-bold mb-1 line-clamp-1 ${overdue ? 'text-error' : 'text-slate-700'}`}>{item.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">{item.content}</p>

                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 15 }}>calendar_today</span>
                      <span className={`font-bold ${overdue ? 'text-error' : 'text-slate-600'}`}>
                        {item.remindDate} {overdue && '(Quá hạn)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 15 }}>person</span>
                      <span className="text-slate-600">Giao cho: <span className="text-slate-700 font-bold">{getEmployeeName(item.assignedToUserId)}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-8 flex flex-col items-center justify-center text-slate-400 bg-white rounded-lg border border-slate-200">
            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 40 }}>event_busy</span>
            <p className="font-medium text-xs mt-2">Không tìm thấy nhắc việc nào.</p>
          </div>
        )}
      </div>
    </div>
  );
};
