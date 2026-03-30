import React, { useMemo } from 'react';
import type {
  Employee,
  ProcedureRaciEntry,
  ProcedureRaciRole,
} from '../../types';
import { resolvePositionName } from '../../utils/employeeDisplay';
import { SearchableSelect } from '../SearchableSelect';
import type { SearchableSelectOption } from '../SearchableSelect';

const RACI_META: Record<ProcedureRaciRole, { label: string; full: string; color: string; bg: string; border: string }> = {
  R: { label: 'R', full: 'Responsible', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  A: { label: 'A', full: 'Accountable', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  C: { label: 'C', full: 'Consulted', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  I: { label: 'I', full: 'Informed', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
};

interface ProcedureRaciTabProps {
  raciLoading: boolean;
  raciUserId: string;
  raciRole: ProcedureRaciRole;
  raciNote: string;
  raciSaving: boolean;
  userOptions: SearchableSelectOption[];
  usersLoading: boolean;
  raciList: ProcedureRaciEntry[];
  employeeCache: Map<string, Employee>;
  onRaciUserChange: (value: string) => void;
  onUserSearchChange: (value: string) => void;
  onRaciRoleChange: (value: ProcedureRaciRole) => void;
  onRaciNoteChange: (value: string) => void;
  onAddRaci: () => void | Promise<void>;
  onRemoveRaci: (entry: ProcedureRaciEntry) => void | Promise<void>;
}

export const ProcedureRaciTab: React.FC<ProcedureRaciTabProps> = ({
  raciLoading,
  raciUserId,
  raciRole,
  raciNote,
  raciSaving,
  userOptions,
  usersLoading,
  raciList,
  employeeCache,
  onRaciUserChange,
  onUserSearchChange,
  onRaciRoleChange,
  onRaciNoteChange,
  onAddRaci,
  onRemoveRaci,
}) => {
  const raciUsers = useMemo(
    () => Array.from(new Set(raciList.map((entry) => String(entry.user_id)))),
    [raciList]
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-deep-teal">person_add</span>
          Thêm phân công RACI
        </h4>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-slate-500 mb-1 block">Thành viên</label>
            <SearchableSelect
              value={raciUserId}
              options={userOptions}
              onChange={onRaciUserChange}
              onSearchTermChange={onUserSearchChange}
              searching={usersLoading}
              placeholder="Chọn thành viên..."
              searchPlaceholder="Tìm theo tên, mã NV, chức vụ..."
              noOptionsText={usersLoading ? 'Đang tìm...' : 'Không tìm thấy nhân viên'}
              usePortal
              portalZIndex={9999}
              triggerClassName="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white"
              dropdownClassName="min-w-[380px] max-w-[520px]"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Vai trò RACI</label>
            <select
              value={raciRole}
              onChange={(event) => onRaciRoleChange(event.target.value as ProcedureRaciRole)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white font-semibold"
            >
              {(['R', 'A', 'C', 'I'] as ProcedureRaciRole[]).map((role) => (
                <option key={role} value={role}>{role} — {RACI_META[role].full}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-500 mb-1 block">Ghi chú (tùy chọn)</label>
            <input
              type="text"
              value={raciNote}
              onChange={(event) => onRaciNoteChange(event.target.value)}
              placeholder="Ghi chú..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white"
            />
          </div>

          <button
            onClick={() => void onAddRaci()}
            disabled={!raciUserId || raciSaving}
            className="px-5 py-2 text-sm font-semibold bg-deep-teal text-white rounded-lg hover:bg-deep-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {raciSaving ? 'Đang lưu...' : 'Thêm'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          * Mỗi người dùng có thể đảm nhận nhiều vai trò R/A/C/I trong cùng một thủ tục.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {(Object.entries(RACI_META) as [ProcedureRaciRole, typeof RACI_META.R][]).map(([role, meta]) => (
          <div key={role} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${meta.bg} ${meta.border}`}>
            <span className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-black shrink-0 ${meta.bg} ${meta.color} border ${meta.border}`}>
              {meta.label}
            </span>
            <div className="min-w-0">
              <div className={`text-xs font-bold leading-tight ${meta.color}`}>{meta.full}</div>
              <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                {role === 'R' && 'Người thực hiện'}
                {role === 'A' && 'Người chịu trách nhiệm'}
                {role === 'C' && 'Người tư vấn'}
                {role === 'I' && 'Người được thông báo'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {raciLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-deep-teal/20 border-t-deep-teal rounded-full" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Thành viên</th>
                {(['R', 'A', 'C', 'I'] as ProcedureRaciRole[]).map((role) => (
                  <th key={role} className="px-4 py-3 text-center w-[90px]">
                    <span className={`inline-flex w-7 h-7 rounded-md items-center justify-center text-xs font-black ${RACI_META[role].bg} ${RACI_META[role].color}`}>
                      {role}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3 w-[36px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {raciUsers.map((uid) => {
                const userRows = raciList.filter((entry) => String(entry.user_id) === uid);
                const user = userRows[0];
                const cachedEmployee = employeeCache.get(uid);
                const displayName = user.full_name || cachedEmployee?.full_name || user.username || uid;
                const displayCode = user.user_code || cachedEmployee?.user_code || '';
                const displayPosition = resolvePositionName(cachedEmployee ?? null);
                const initials = displayName.charAt(0).toUpperCase();

                return (
                  <tr key={uid} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-deep-teal/10 text-deep-teal flex items-center justify-center text-sm font-bold shrink-0">
                          {initials}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-slate-700 leading-tight">{displayName}</div>
                          {displayCode && (
                            <div className="text-xs text-slate-400 leading-tight">{displayCode}</div>
                          )}
                          {displayPosition && displayPosition !== 'Chưa cập nhật' && (
                            <div className="text-[11px] text-slate-400 leading-tight italic">{displayPosition}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {(['R', 'A', 'C', 'I'] as ProcedureRaciRole[]).map((role) => {
                      const entry = userRows.find((row) => row.raci_role === role);
                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          {entry ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black ${RACI_META[role].bg} ${RACI_META[role].color}`}>
                                {role}
                              </span>
                              <button
                                onClick={() => void onRemoveRaci(entry)}
                                data-testid={`procedure-raci-remove-${entry.id}`}
                                title="Xóa phân công này"
                                className="text-[10px] text-slate-300 hover:text-red-400 transition-colors leading-none"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                );
              })}
              {raciList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300">group</span>
                    Chưa có phân công RACI nào. Sử dụng form phía trên để thêm thành viên.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
