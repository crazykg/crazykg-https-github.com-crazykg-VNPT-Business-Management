import React, { useEffect, useMemo, useState } from 'react';
import { AuditLog, Employee } from '../types';
import { PaginationControls } from './PaginationControls';

interface AuditLogListProps {
  auditLogs: AuditLog[];
  employees: Employee[];
}

const SQL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const parseSqlDateTime = (value: string): Date | null => {
  if (!SQL_DATETIME_REGEX.test(value)) {
    return null;
  }

  const [datePart, timePart] = value.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, second);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    return null;
  }

  return parsed;
};

const pad = (value: number): string => String(value).padStart(2, '0');

const formatAuditDateTime = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const sqlParsed = parseSqlDateTime(value);
  const parsed = sqlParsed || new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const day = pad(parsed.getDate());
  const month = pad(parsed.getMonth() + 1);
  const year = parsed.getFullYear();
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());
  const seconds = pad(parsed.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

export const AuditLogList: React.FC<AuditLogListProps> = ({ auditLogs = [], employees = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const getActorLabel = (log: AuditLog): string => {
    if (log.created_by === null || log.created_by === undefined || String(log.created_by).trim() === '') {
      return 'Hệ thống';
    }

    const actorName = log.actor?.full_name || log.actor?.username;
    if (actorName) {
      return actorName;
    }

    const matchById = (employees || []).find((employee) => String(employee.id) === String(log.created_by));
    if (matchById) {
      return matchById.full_name || matchById.username || String(log.created_by);
    }

    return 'Unknown User';
  };

  const filteredLogs = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return (auditLogs || []).filter((log) => {
      const actor = getActorLabel(log).toLowerCase();
      const matchesSearch =
        String(log.id).toLowerCase().includes(searchLower) ||
        (log.event || '').toLowerCase().includes(searchLower) ||
        (log.auditable_type || '').toLowerCase().includes(searchLower) ||
        String(log.auditable_id || '').toLowerCase().includes(searchLower) ||
        actor.includes(searchLower) ||
        (log.ip_address || '').toLowerCase().includes(searchLower);
      const matchesEvent = eventFilter ? log.event === eventFilter : true;
      return matchesSearch && matchesEvent;
    });
  }, [auditLogs, employees, eventFilter, searchTerm]);

  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = filteredLogs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Lịch sử Hệ thống</h2>
          <p className="text-slate-500 text-sm mt-1">Theo dõi thao tác INSERT/UPDATE/DELETE/RESTORE.</p>
        </div>
      </header>

      <div className="animate-fade-in">
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-wrap gap-4 items-center">
            <div className="col-span-1 lg:flex-1 min-w-[220px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
                placeholder="Tìm kiếm theo id, event, bảng, actor, IP"
              />
            </div>
            <div className="col-span-1 md:w-full lg:w-44 relative">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer"
              >
                <option value="">Sự kiện</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="RESTORE">RESTORE</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[100px]"><span className="text-deep-teal">ID</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[120px]"><span className="text-deep-teal">EVENT</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[220px]"><span className="text-deep-teal">BẢNG DỮ LIỆU</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[130px]"><span className="text-deep-teal">BẢN GHI</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[170px]"><span className="text-deep-teal">NGƯỜI THỰC HIỆN</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[130px]"><span className="text-deep-teal">IP</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[260px]"><span className="text-deep-teal">URL</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[180px]"><span className="text-deep-teal">THỜI GIAN</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.length > 0 ? (
                  currentData.map((log) => (
                    <tr key={`${log.id}-${log.created_at}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 font-bold">{log.id}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-semibold">{log.event}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{log.auditable_type}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-mono">{log.auditable_id}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{getActorLabel(log)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono">{log.ip_address || '--'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[260px]" title={log.url || ''}>{log.url || '--'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatAuditDateTime(log.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">history</span>
                        <p>Chưa có dữ liệu audit log.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>
    </div>
  );
};
