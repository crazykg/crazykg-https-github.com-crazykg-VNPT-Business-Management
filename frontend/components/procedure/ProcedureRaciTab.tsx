import React, { useMemo } from 'react';
import type {
  Employee,
  ProcedureRaciEntry,
  ProcedureRaciRole,
} from '../../types';
import { useEscKey } from '../../hooks/useEscKey';
import { resolvePositionName } from '../../utils/employeeDisplay';
import { SearchableSelect } from '../SearchableSelect';
import type { SearchableSelectOption } from '../SearchableSelect';

const RACI_META: Record<ProcedureRaciRole, { label: string; full: string; color: string; bg: string; border: string }> = {
  R: { label: 'R', full: 'Responsible', color: 'text-primary', bg: 'bg-primary/8', border: 'border-primary/25' },
  A: { label: 'A', full: 'Accountable', color: 'text-deep-teal', bg: 'bg-deep-teal/8', border: 'border-deep-teal/25' },
  C: { label: 'C', full: 'Consulted', color: 'text-tertiary', bg: 'bg-tertiary/8', border: 'border-tertiary/25' },
  I: { label: 'I', full: 'Informed', color: 'text-neutral', bg: 'bg-neutral/8', border: 'border-neutral/20' },
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
  existingAccountable: ProcedureRaciEntry | null;
  showAccountableConfirm: boolean;
  onRaciUserChange: (value: string) => void;
  onUserSearchChange: (value: string) => void;
  onRaciRoleChange: (value: ProcedureRaciRole) => void;
  onRaciNoteChange: (value: string) => void;
  onConfirmAccountableReplacement: () => void;
  onCancelAccountableReplacement: () => void;
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
  existingAccountable,
  showAccountableConfirm,
  onRaciUserChange,
  onUserSearchChange,
  onRaciRoleChange,
  onRaciNoteChange,
  onConfirmAccountableReplacement,
  onCancelAccountableReplacement,
  onAddRaci,
  onRemoveRaci,
}) => {
  useEscKey(() => {
    if (showAccountableConfirm) {
      onCancelAccountableReplacement();
    }
  }, showAccountableConfirm);

  const raciUsers = useMemo(
    () => Array.from(new Set(raciList.map((entry) => String(entry.user_id)))),
    [raciList]
  );
  const accountableLabel = [existingAccountable?.full_name, existingAccountable?.user_code]
    .filter(Boolean)
    .join(' - ');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3 mb-3">
        <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>person_add</span>
          Thêm phân công RACI
        </h4>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs font-semibold text-neutral mb-1 block">Thành viên</label>
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
              triggerClassName="w-full h-8 px-3 text-xs border border-slate-200 rounded focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white"
              dropdownClassName="min-w-[380px] max-w-[520px]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral mb-1 block">Vai trò RACI</label>
            <select
              value={raciRole}
              onChange={(event) => onRaciRoleChange(event.target.value as ProcedureRaciRole)}
              className="h-8 px-3 text-xs border border-slate-200 rounded focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white font-semibold"
            >
              {(['R', 'A', 'C', 'I'] as ProcedureRaciRole[]).map((role) => (
                <option key={role} value={role}>{role} — {RACI_META[role].full}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-semibold text-neutral mb-1 block">Ghi chú (tùy chọn)</label>
            <input
              type="text"
              value={raciNote}
              onChange={(event) => onRaciNoteChange(event.target.value)}
              placeholder="Ghi chú..."
              className="w-full h-8 px-3 text-xs border border-slate-200 rounded focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white"
            />
          </div>

          <button
            onClick={() => void onAddRaci()}
            disabled={!raciUserId || raciSaving}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {raciSaving ? 'Đang lưu...' : 'Thêm'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          * Mỗi người dùng có thể đảm nhận nhiều vai trò R/A/C/I trong cùng một thủ tục.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {(Object.entries(RACI_META) as [ProcedureRaciRole, typeof RACI_META.R][]).map(([role, meta]) => (
          <div key={role} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${meta.bg} ${meta.border}`}>
            <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black shrink-0 ${meta.bg} ${meta.color} border ${meta.border}`}>
              {meta.label}
            </span>
            <div className="min-w-0">
              <div className={`text-[11px] font-bold leading-tight ${meta.color}`}>{meta.full}</div>
              <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
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
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-deep-teal/20 border-t-deep-teal rounded-full" />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[500px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Thành viên</th>
                  {(['R', 'A', 'C', 'I'] as ProcedureRaciRole[]).map((role) => (
                    <th key={role} className="px-3 py-2 text-center w-[80px]">
                      <span className={`inline-flex w-6 h-6 rounded items-center justify-center text-xs font-black ${RACI_META[role].bg} ${RACI_META[role].color}`}>
                        {role}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 w-[36px]" />
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
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-deep-teal/10 text-deep-teal flex items-center justify-center text-xs font-bold shrink-0">
                            {initials}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-slate-700 leading-tight">{displayName}</div>
                            {displayCode && (
                              <div className="text-[10px] text-slate-400 leading-tight">{displayCode}</div>
                            )}
                            {displayPosition && displayPosition !== 'Chưa cập nhật' && (
                              <div className="text-[10px] text-slate-400 leading-tight italic">{displayPosition}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      {(['R', 'A', 'C', 'I'] as ProcedureRaciRole[]).map((role) => {
                        const entry = userRows.find((row) => row.raci_role === role);
                        return (
                          <td key={role} className="px-3 py-2 text-center">
                            {entry ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black ${RACI_META[role].bg} ${RACI_META[role].color}`}>
                                  {role}
                                </span>
                                <button
                                  onClick={() => void onRemoveRaci(entry)}
                                  data-testid={`procedure-raci-remove-${entry.id}`}
                                  title="Xóa phân công này"
                                  className="text-[10px] text-slate-300 hover:text-error transition-colors leading-none"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
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
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                      <span className="material-symbols-outlined text-slate-300 block mb-2" style={{ fontSize: 32 }}>group</span>
                      Chưa có phân công RACI nào. Sử dụng form phía trên để thêm thành viên.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAccountableConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onCancelAccountableReplacement}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in">
            <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10">
                <span className="material-symbols-outlined text-warning" style={{ fontSize: 18 }}>warning</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-deep-teal">Đã tồn tại người chịu trách nhiệm (A)</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {accountableLabel
                    ? `Hiện tại ${accountableLabel} đang giữ vai trò A.`
                    : 'Hiện tại thủ tục đã có một người giữ vai trò A.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng xác nhận thay A"
                onClick={onCancelAccountableReplacement}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-slate-600">
                Nếu tiếp tục, hệ thống sẽ cập nhật lại người giữ vai trò A trước đó bằng lựa chọn mới ở lần lưu thêm tiếp theo.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelAccountableReplacement}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Tạm ngưng
                </button>
                <button
                  type="button"
                  onClick={onConfirmAccountableReplacement}
                  className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal"
                >
                  Tiếp tục
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
