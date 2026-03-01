import React, { useEffect, useMemo, useState } from 'react';
import { SupportRequestStatusOption, SupportServiceGroup } from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect, SearchableSelectOption } from './SearchableSelect';

type MasterType = 'group' | 'status';
type ActivityFilter = 'all' | 'active' | 'inactive';
type FormMode = 'ADD' | 'EDIT';

interface SupportMasterManagementProps {
  supportServiceGroups: SupportServiceGroup[];
  supportRequestStatuses: SupportRequestStatusOption[];
  onCreateSupportServiceGroup: (
    payload: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ) => Promise<SupportServiceGroup>;
  onUpdateSupportServiceGroup: (
    id: string | number,
    payload: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ) => Promise<SupportServiceGroup>;
  onCreateSupportRequestStatus: (
    payload: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportRequestStatusOption>;
  onUpdateSupportRequestStatus: (
    id: string | number,
    payload: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportRequestStatusOption>;
  canWriteServiceGroups?: boolean;
  canWriteStatuses?: boolean;
}

interface GroupFormState {
  group_code: string;
  group_name: string;
  description: string;
  is_active: boolean;
}

interface StatusFormState {
  status_code: string;
  status_name: string;
  description: string;
  requires_completion_dates: boolean;
  is_terminal: boolean;
  is_transfer_dev: boolean;
  is_active: boolean;
  sort_order: number;
}

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeGroupCodeInput = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);

const defaultGroupForm = (): GroupFormState => ({
  group_code: '',
  group_name: '',
  description: '',
  is_active: true,
});

const defaultStatusForm = (sortOrder: number): StatusFormState => ({
  status_code: '',
  status_name: '',
  description: '',
  requires_completion_dates: true,
  is_terminal: false,
  is_transfer_dev: false,
  is_active: true,
  sort_order: sortOrder,
});

export const SupportMasterManagement: React.FC<SupportMasterManagementProps> = ({
  supportServiceGroups = [],
  supportRequestStatuses = [],
  onCreateSupportServiceGroup,
  onUpdateSupportServiceGroup,
  onCreateSupportRequestStatus,
  onUpdateSupportRequestStatus,
  canWriteServiceGroups = true,
  canWriteStatuses = true,
}) => {
  const [masterType, setMasterType] = useState<MasterType>('group');
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingGroup, setEditingGroup] = useState<SupportServiceGroup | null>(null);
  const [editingStatus, setEditingStatus] = useState<SupportRequestStatusOption | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(defaultGroupForm);
  const [statusForm, setStatusForm] = useState<StatusFormState>(() => defaultStatusForm(10));
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const masterOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: 'group', label: 'Nhóm Zalo/Tele' },
      { value: 'status', label: 'Trạng thái hỗ trợ' },
    ],
    []
  );

  const canWriteCurrentMaster = masterType === 'group' ? canWriteServiceGroups : canWriteStatuses;

  const nextSortOrder = useMemo(() => {
    const maxSort = (supportRequestStatuses || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);
    return Math.max(10, maxSort + 10);
  }, [supportRequestStatuses]);

  const filteredGroups = useMemo(() => {
    const keyword = normalizeToken(searchTerm);
    return (supportServiceGroups || []).filter((group) => {
      const isActive = group.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${group.group_code || ''} ${group.group_name || ''} ${group.description || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;
      return matchesActivity && matchesSearch;
    });
  }, [supportServiceGroups, activityFilter, searchTerm]);

  const filteredStatuses = useMemo(() => {
    const keyword = normalizeToken(searchTerm);
    return (supportRequestStatuses || []).filter((status) => {
      const isActive = status.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${status.status_code || ''} ${status.status_name || ''} ${status.description || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;
      return matchesActivity && matchesSearch;
    });
  }, [supportRequestStatuses, activityFilter, searchTerm]);

  const activeFilteredRows = useMemo(
    () => (masterType === 'group' ? filteredGroups : filteredStatuses),
    [masterType, filteredGroups, filteredStatuses]
  );

  const totalItems = activeFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, rowsPerPage)));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [masterType, searchTerm, activityFilter, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedGroups = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredGroups.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredGroups, safePage, rowsPerPage]);

  const pagedStatuses = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredStatuses.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredStatuses, safePage, rowsPerPage]);

  const closeForm = () => {
    setFormMode(null);
    setEditingGroup(null);
    setEditingStatus(null);
    setGroupForm(defaultGroupForm());
    setStatusForm(defaultStatusForm(nextSortOrder));
    setFormError('');
    setIsSubmitting(false);
  };

  const openGroupAdd = () => {
    setFormMode('ADD');
    setEditingGroup(null);
    setGroupForm(defaultGroupForm());
    setFormError('');
  };

  const openGroupEdit = (group: SupportServiceGroup) => {
    setFormMode('EDIT');
    setEditingGroup(group);
    setGroupForm({
      group_code: String(group.group_code || ''),
      group_name: String(group.group_name || ''),
      description: String(group.description || ''),
      is_active: group.is_active !== false,
    });
    setFormError('');
  };

  const openStatusAdd = () => {
    setFormMode('ADD');
    setEditingStatus(null);
    setStatusForm(defaultStatusForm(nextSortOrder));
    setFormError('');
  };

  const openStatusEdit = (status: SupportRequestStatusOption) => {
    setFormMode('EDIT');
    setEditingStatus(status);
    setStatusForm({
      status_code: String(status.status_code || ''),
      status_name: String(status.status_name || ''),
      description: String(status.description || ''),
      requires_completion_dates: status.requires_completion_dates !== false,
      is_terminal: status.is_terminal === true,
      is_transfer_dev: status.is_transfer_dev === true,
      is_active: status.is_active !== false,
      sort_order: Number.isFinite(Number(status.sort_order)) ? Number(status.sort_order) : 0,
    });
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');
    setIsSubmitting(true);
    try {
      if (masterType === 'group') {
        if (!groupForm.group_name.trim()) {
          setFormError('Tên nhóm là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (formMode === 'ADD') {
          await onCreateSupportServiceGroup({
            group_code: groupForm.group_code.trim() || null,
            group_name: groupForm.group_name.trim(),
            description: groupForm.description.trim() || null,
            is_active: groupForm.is_active,
          });
        } else if (formMode === 'EDIT' && editingGroup) {
          await onUpdateSupportServiceGroup(editingGroup.id, {
            group_code: groupForm.group_code.trim() || null,
            group_name: groupForm.group_name.trim(),
            description: groupForm.description.trim() || null,
            is_active: groupForm.is_active,
          });
        }
      } else {
        const statusCode = statusForm.status_code.trim().toUpperCase();
        if (!statusCode) {
          setFormError('Mã trạng thái là bắt buộc.');
          setIsSubmitting(false);
          return;
        }
        if (!statusForm.status_name.trim()) {
          setFormError('Tên trạng thái là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (formMode === 'ADD') {
          await onCreateSupportRequestStatus({
            status_code: statusCode,
            status_name: statusForm.status_name.trim(),
            description: statusForm.description.trim() || null,
            requires_completion_dates: statusForm.requires_completion_dates,
            is_terminal: statusForm.is_terminal,
            is_transfer_dev: statusForm.is_transfer_dev,
            is_active: statusForm.is_active,
            sort_order: Math.max(0, Number(statusForm.sort_order || 0)),
          });
        } else if (formMode === 'EDIT' && editingStatus) {
          if (editingStatus.id === null || editingStatus.id === undefined) {
            setFormError('Trạng thái này chưa có bản ghi DB, không thể cập nhật trực tiếp.');
            setIsSubmitting(false);
            return;
          }

          await onUpdateSupportRequestStatus(editingStatus.id, {
            status_code: statusCode,
            status_name: statusForm.status_name.trim(),
            description: statusForm.description.trim() || null,
            requires_completion_dates: statusForm.requires_completion_dates,
            is_terminal: statusForm.is_terminal,
            is_transfer_dev: statusForm.is_transfer_dev,
            is_active: statusForm.is_active,
            sort_order: Math.max(0, Number(statusForm.sort_order || 0)),
          });
        }
      }
      closeForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu danh mục.');
      setIsSubmitting(false);
    }
  };

  const statusCodeEditable =
    formMode === 'ADD'
      ? true
      : Boolean(editingStatus?.is_code_editable ?? ((editingStatus?.used_in_requests ?? 0) + (editingStatus?.used_in_history ?? 0) === 0));

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8 rounded-2xl" style={{ backgroundColor: 'rgb(242 239 231 / var(--tw-bg-opacity, 1))' }}>
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Quản lý danh mục hỗ trợ</h2>
          <p className="text-slate-600 text-sm mt-1">Quản trị Nhóm Zalo/Tele và Trạng thái yêu cầu hỗ trợ theo trạng thái hoạt động.</p>
        </div>
        <button
          type="button"
          disabled={!canWriteCurrentMaster}
          onClick={() => (masterType === 'group' ? openGroupAdd() : openStatusAdd())}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Thêm mới</span>
        </button>
      </header>

      <div className="bg-white/95 p-4 md:p-5 rounded-xl border border-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchableSelect
            value={masterType}
            onChange={(value) => setMasterType(value as MasterType)}
            options={masterOptions}
            placeholder="Chọn danh mục"
          />

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm kiếm danh mục..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <SearchableSelect
            value={activityFilter}
            onChange={(value) => setActivityFilter(value as ActivityFilter)}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'active', label: 'Hoạt động' },
              { value: 'inactive', label: 'Ngưng hoạt động' },
            ]}
            placeholder="Lọc hoạt động"
          />
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          {masterType === 'group' ? (
            <table className="w-full min-w-[920px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã nhóm</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên nhóm</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedGroups.map((item) => (
                  <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-800">{item.group_code || '--'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{item.group_name || '--'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.description || '--'}</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">
                      {Number(item.used_in_support_requests || 0)} / {Number(item.used_in_programming_requests || 0)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        disabled={!canWriteServiceGroups}
                        onClick={() => openGroupEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Cập nhật"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {pagedGroups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Không có dữ liệu nhóm phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[1240px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Bắt buộc hạn</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Chuyển Dev</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Kết thúc</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedStatuses.map((item) => {
                  const usedInRequests = Number(item.used_in_requests || 0);
                  const usedInHistory = Number(item.used_in_history || 0);
                  const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;
                  return (
                    <tr key={String(item.id ?? item.status_code)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.status_code || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.status_name || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.requires_completion_dates !== false ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_transfer_dev === true ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_terminal === true ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{usedInRequests} / {usedInHistory}</td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openStatusEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canEditRow ? 'Cập nhật' : 'Không thể cập nhật trạng thái chưa đồng bộ DB'}
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pagedStatuses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">Không có dữ liệu trạng thái phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <PaginationControls
          currentPage={safePage}
          totalItems={totalItems}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45" onClick={closeForm}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-[0_24px_64px_rgba(15,23,42,0.18)] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
              <h3 className="text-lg font-bold text-slate-900">
                {masterType === 'group'
                  ? formMode === 'ADD' ? 'Thêm nhóm Zalo/Tele' : 'Cập nhật nhóm Zalo/Tele'
                  : formMode === 'ADD' ? 'Thêm trạng thái hỗ trợ' : 'Cập nhật trạng thái hỗ trợ'}
              </h3>
              <button type="button" onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {masterType === 'group' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Mã nhóm</label>
                      <input
                        value={groupForm.group_code}
                        onChange={(event) =>
                          setGroupForm((prev) => ({ ...prev, group_code: normalizeGroupCodeInput(event.target.value) }))
                        }
                        placeholder="VD: HIS_L2"
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                      />
                      <p className="text-xs text-slate-500">Để trống hệ thống tự sinh theo Tên nhóm.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Tên nhóm <span className="text-red-500">*</span></label>
                      <input
                        value={groupForm.group_name}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, group_name: event.target.value }))}
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                    <textarea
                      value={groupForm.description}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={groupForm.is_active}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    Hoạt động
                  </label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Mã trạng thái <span className="text-red-500">*</span></label>
                      <input
                        value={statusForm.status_code}
                        disabled={!statusCodeEditable}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, status_code: event.target.value.toUpperCase() }))}
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Tên trạng thái <span className="text-red-500">*</span></label>
                      <input
                        value={statusForm.status_name}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, status_name: event.target.value }))}
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  {!statusCodeEditable && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Đã phát sinh dữ liệu, không cho đổi mã trạng thái.
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                    <textarea
                      value={statusForm.description}
                      onChange={(event) => setStatusForm((prev) => ({ ...prev, description: event.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.requires_completion_dates}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, requires_completion_dates: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Bắt buộc nhập hạn/ngày hoàn thành
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.is_transfer_dev}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, is_transfer_dev: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Chuyển Dev
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.is_terminal}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, is_terminal: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Trạng thái kết thúc
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.is_active}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Hoạt động
                    </label>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                    <input
                      type="number"
                      min={0}
                      value={statusForm.sort_order}
                      onChange={(event) => setStatusForm((prev) => ({ ...prev, sort_order: Number(event.target.value || 0) }))}
                      className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </>
              )}

              {formError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{formError}</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-60"
              >
                {isSubmitting ? 'Đang lưu...' : formMode === 'ADD' ? 'Thêm mới' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
