import React, { useEffect, useMemo, useState } from 'react';
import type { Department, Employee, EmployeePartyListItem, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { useEscKey } from '../hooks/useEscKey';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { getEmployeeCode } from '../utils/employeeDisplay';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface EmployeePartyListQuery extends PaginatedQuery {
  filters?: {
    department_id?: string;
    missing_info?: string;
  };
}

interface EmployeePartyListProps {
  partyProfiles: EmployeePartyListItem[];
  employees: Employee[];
  departments: Department[];
  onOpenModal: (type: ModalType, item?: EmployeePartyListItem) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  canImport?: boolean;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: EmployeePartyListQuery) => void;
}

const QUALITY_OPTIONS = [
  { value: '', label: 'Thiếu thông tin' },
  { value: 'CARD_NUMBER', label: 'Thiếu số thẻ Đảng' },
];

const getDepartmentLabel = (employee: Employee | null | undefined, departments: Department[]): string => {
  if (!employee) return '--';
  if (employee.department && typeof employee.department === 'object') {
    const department = employee.department as { dept_code?: string; dept_name?: string };
    const code = String(department.dept_code || '').trim();
    const name = String(department.dept_name || '').trim();
    if (code || name) {
      return [code, name].filter(Boolean).join(' - ');
    }
  }

  const department = departments.find((item) => String(item.id) === String(employee.department_id));
  return department ? `${department.dept_code} - ${department.dept_name}` : '--';
};

const getProfileEmployeeCode = (profile: EmployeePartyListItem): string =>
  profile.employee ? getEmployeeCode(profile.employee) : String(profile.employee_id || '--');

const isMissingPartyCard = (profile: EmployeePartyListItem): boolean =>
  Boolean(profile.profile_quality?.missing_card_number) || !String(profile.party_card_number || '').trim();

const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50';

const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal';

const compactInputClass =
  'h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30';

const compactSelectTriggerClass =
  'h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30';

const menuPanelClass =
  'absolute top-full z-20 mt-2 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in';

const menuItemClass =
  'flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50';

const tableActionButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors';

const formatCount = (value: number): string => new Intl.NumberFormat('vi-VN').format(value || 0);

export const EmployeePartyList: React.FC<EmployeePartyListProps> = ({
  partyProfiles = [],
  employees = [],
  departments = [],
  onOpenModal,
  onNotify,
  canImport = false,
  paginationMeta,
  isLoading = false,
  onQueryChange,
}: EmployeePartyListProps) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const sortedDepartments = useMemo(
    () => [...departments].sort((left, right) => `${left.dept_code} ${left.dept_name}`.localeCompare(`${right.dept_code} ${right.dept_name}`, 'vi')),
    [departments]
  );

  const departmentFilterOptions = useMemo(
    () => [
      { value: '', label: 'Phòng ban' },
      ...sortedDepartments.map((department) => ({
        value: String(department.id),
        label: department.dept_name,
        searchText: `${department.dept_code} ${department.dept_name}`,
      })),
    ],
    [sortedDepartments]
  );

  const filteredProfiles = useMemo(() => {
    if (serverMode) {
      return partyProfiles;
    }

    const searchLower = searchTerm.trim().toLowerCase();
    return partyProfiles.filter((profile) => {
      const employee = profile.employee;
      const matchesSearch =
        !searchLower ||
        getProfileEmployeeCode(profile).toLowerCase().includes(searchLower) ||
        String(employee?.full_name || '').toLowerCase().includes(searchLower);
      const matchesDepartment = !departmentFilter || String(employee?.department_id ?? '') === String(departmentFilter);
      const missingCard = Boolean(profile.profile_quality?.missing_card_number) || !String(profile.party_card_number || '').trim();
      const matchesQuality = !qualityFilter
        || (qualityFilter === 'CARD_NUMBER' && missingCard);

      return matchesSearch && matchesDepartment && matchesQuality;
    });
  }, [departmentFilter, partyProfiles, qualityFilter, searchTerm, serverMode]);

  useEffect(() => {
    if (!serverMode || !onQueryChange) {
      return;
    }

    onQueryChange({
      page: currentPage,
      per_page: rowsPerPage,
      q: searchTerm.trim(),
      sort_by: 'user_code',
      sort_dir: 'asc',
      filters: {
        department_id: departmentFilter,
        missing_info: qualityFilter,
      },
    });
  }, [currentPage, departmentFilter, onQueryChange, qualityFilter, rowsPerPage, searchTerm, serverMode]);

  const totalItems = serverMode ? paginationMeta?.total || 0 : filteredProfiles.length;
  const currentData = serverMode
    ? partyProfiles
    : filteredProfiles.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const hasActiveFilters = Boolean(searchTerm.trim() || departmentFilter || qualityFilter);

  const exportRows = serverMode ? partyProfiles : filteredProfiles;

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const employeeSheetRows = employees.map((employee) => [
      getEmployeeCode(employee),
      employee.full_name || '',
      formatDateDdMmYyyy(employee.date_of_birth || null),
      getDepartmentLabel(employee, departments),
      employee.job_title_vi || employee.job_title_raw || '',
    ]);

    downloadExcelWorkbook('mau_nhap_dang_vien', [
      {
        name: 'DangVien',
        headers: [
          'Mã NV',
          'Họ tên',
          'Số thẻ Đảng',
          'Quê quán',
          'Dân tộc',
          'Tôn giáo',
          'Trình độ chuyên môn',
          'LLCT',
          'Ghi chú',
        ],
        rows: [
          ['VNPT000001', 'Nguyễn Văn A', '093066006328', 'Nam Định', 'Kinh', 'Không', 'Kỹ sư CNTT', 'Trung cấp', ''],
          ['VNPT000002', 'Trần Thị B', '', 'Hải Phòng', 'Kinh', 'Không', 'Cử nhân', 'Sơ cấp', 'Thiếu số thẻ cần bổ sung'],
        ],
      },
      {
        name: 'NhanSu',
        headers: ['Mã NV', 'Họ tên', 'Ngày sinh', 'Phòng ban', 'Chức vụ'],
        rows: employeeSheetRows,
      },
    ]);
  };

  const handleExport = (format: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Mã NV', 'Họ tên', 'Phòng ban', 'Ngày sinh', 'Số thẻ', 'Quê quán', 'Dân tộc', 'Tôn giáo', 'Trình độ', 'LLCT', 'Ghi chú'];
    const rows = exportRows.map((profile) => [
      getProfileEmployeeCode(profile),
      profile.employee?.full_name || '',
      getDepartmentLabel(profile.employee, departments),
      formatDateDdMmYyyy(profile.employee?.date_of_birth || null),
      profile.party_card_number || '',
      profile.hometown || '',
      profile.ethnicity || '',
      profile.religion || '',
      profile.professional_qualification || '',
      profile.political_theory_level || '',
      profile.notes || '',
    ]);
    const fileName = `danh_sach_dang_vien_${isoDateStamp()}`;

    if (format === 'excel') {
      exportExcel(fileName, 'DangVien', headers, rows);
      return;
    }

    if (format === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sach dang vien',
      headers,
      rows,
      subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      onNotify?.('error', 'Xuất dữ liệu', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
    }
  };

  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-3 p-3 pb-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>shield</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-tight text-deep-teal">Quản lý Đảng viên</h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canImport ? (
                <div className="relative">
                  <button
                    onClick={() => setShowImportMenu((prev) => !prev)}
                    className={`${secondaryButtonClass} min-w-[92px] justify-center`}
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>upload</span>
                    Nhập
                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>expand_more</span>
                  </button>

                  {showImportMenu ? (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                      <div className={`${menuPanelClass} left-0 w-48`}>
                        <button
                          onClick={() => {
                            setShowImportMenu(false);
                            onOpenModal('IMPORT_DATA');
                          }}
                          className={menuItemClass}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>upload_file</span>
                          Nhập danh sách
                        </button>
                        <button
                          onClick={handleDownloadTemplate}
                          className={`${menuItemClass} border-t border-slate-100`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                          Tải file mẫu
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((prev) => !prev)}
                  className={`${secondaryButtonClass} min-w-[92px] justify-center`}
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>download</span>
                  Xuất
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>expand_more</span>
                </button>

                {showExportMenu ? (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className={`${menuPanelClass} right-0 w-40`}>
                      <button onClick={() => handleExport('excel')} className={menuItemClass}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>table_view</span>
                        Excel
                      </button>
                      <button onClick={() => handleExport('csv')} className={`${menuItemClass} border-t border-slate-100`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>csv</span>
                        CSV
                      </button>
                      <button onClick={() => handleExport('pdf')} className={`${menuItemClass} border-t border-slate-100`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>picture_as_pdf</span>
                        PDF
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              <button
                onClick={() => onOpenModal('ADD_PARTY_PROFILE')}
                className={primaryButtonClass}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                Thêm hồ sơ Đảng viên
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>filter_alt</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Bộ lọc và rà soát</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                Hiển thị {formatCount(currentData.length)} / {formatCount(totalItems)}
              </span>
              {hasActiveFilters ? (
                <span className="inline-flex items-center rounded-full bg-primary-container-soft px-2 py-0.5 text-[10px] font-bold text-deep-teal">
                  Bộ lọc đang bật
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(260px,1.2fr)_240px_220px] xl:items-center">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 16 }}>search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className={`pl-9 ${compactInputClass}`}
                placeholder="Tìm theo mã NV, họ tên"
              />
            </div>

            <SearchableSelect
              value={departmentFilter}
              onChange={(value) => {
                setDepartmentFilter(value);
                setCurrentPage(1);
              }}
              options={departmentFilterOptions}
              placeholder="Phòng ban"
              triggerClassName={compactSelectTriggerClass}
            />

            <SearchableSelect
              value={qualityFilter}
              onChange={(value) => {
                setQualityFilter(value);
                setCurrentPage(1);
              }}
              options={QUALITY_OPTIONS}
              placeholder="Thiếu thông tin"
              triggerClassName={compactSelectTriggerClass}
            />
          </div>
        </div>

        {currentData.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
              <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>
                {isLoading ? 'hourglass_top' : 'shield'}
              </span>
              <h3 className="text-sm font-semibold text-slate-900">
                {isLoading
                  ? 'Đang tải hồ sơ Đảng viên...'
                  : partyProfiles.length === 0 && !hasActiveFilters
                    ? 'Chưa có hồ sơ Đảng viên'
                    : 'Không tìm thấy hồ sơ phù hợp'}
              </h3>
              {!isLoading ? (
                <p className="text-[11px] leading-5 text-slate-400">
                  Tạo hồ sơ đầu tiên hoặc tải workbook mẫu để chuẩn hóa dữ liệu import theo Mã NV.
                </p>
              ) : null}
              {!isLoading ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={handleDownloadTemplate} className={secondaryButtonClass}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                    Tải file mẫu
                  </button>
                  <button type="button" onClick={() => onOpenModal('ADD_PARTY_PROFILE')} className={primaryButtonClass}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                    Thêm hồ sơ đầu tiên
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="bg-white">
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1280px] w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50/90">
                  <tr>
                    {[
                      { label: 'MÃ NV', width: 'min-w-[160px]' },
                      { label: 'HỒ SƠ', width: 'min-w-[220px]' },
                      { label: 'PHÒNG BAN', width: 'min-w-[220px]' },
                      { label: 'THÔNG TIN ĐẢNG', width: 'min-w-[250px]' },
                      { label: 'QUÊ QUÁN', width: 'min-w-[220px]' },
                      { label: 'GHI CHÚ', width: 'min-w-[220px]' },
                      { label: 'THẺ ĐẢNG', width: 'min-w-[180px]' },
                    ].map((column) => (
                      <th
                        key={column.label}
                        className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral ${column.width}`}
                      >
                        <span className="text-deep-teal">{column.label}</span>
                      </th>
                    ))}
                    <th className="sticky right-0 bg-slate-50/95 px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-neutral shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.18)]">
                      THAO TÁC
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentData.map((profile) => {
                    const employee = profile.employee;
                    const missingCard = isMissingPartyCard(profile);
                    const noteText = String(profile.notes || '').trim();

                    return (
                      <tr key={profile.id} className="group transition-colors hover:bg-slate-50/90">
                        <td className="min-w-[160px] px-4 py-3">
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs font-bold text-deep-teal">{getProfileEmployeeCode(profile)}</p>
                            <p className="text-[10px] text-slate-400">Mã hồ sơ: {profile.id}</p>
                          </div>
                        </td>
                        <td className="min-w-[220px] px-4 py-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">{employee?.full_name || '--'}</p>
                            <p className="text-[11px] text-slate-500">
                              Ngày sinh: {formatDateDdMmYyyy(employee?.date_of_birth || null)}
                            </p>
                          </div>
                        </td>
                        <td className="min-w-[220px] px-4 py-3 text-sm text-slate-600">{getDepartmentLabel(employee, departments)}</td>
                        <td className="min-w-[250px] px-4 py-3">
                          <div className="space-y-1.5 text-sm text-slate-600">
                            <p><span className="text-slate-400">Số thẻ:</span> {profile.party_card_number || '--'}</p>
                            <p><span className="text-slate-400">Trình độ:</span> {profile.professional_qualification || '--'}</p>
                            <p><span className="text-slate-400">LLCT:</span> {profile.political_theory_level || '--'}</p>
                          </div>
                        </td>
                        <td className="min-w-[220px] px-4 py-3">
                          <div className="space-y-1.5 text-sm text-slate-600">
                            <p><span className="text-slate-400">Quê quán:</span> {profile.hometown || '--'}</p>
                            <p><span className="text-slate-400">Dân tộc:</span> {profile.ethnicity || '--'}</p>
                            <p><span className="text-slate-400">Tôn giáo:</span> {profile.religion || '--'}</p>
                          </div>
                        </td>
                        <td className="min-w-[220px] max-w-[260px] px-4 py-3 text-sm text-slate-600">
                          <p className="break-words leading-5">{noteText || 'Chưa có ghi chú bổ sung.'}</p>
                        </td>
                        <td className="min-w-[180px] px-4 py-3">
                          <div className="space-y-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${missingCard ? 'bg-tertiary-fixed text-tertiary ring-1 ring-tertiary/20' : 'bg-secondary-fixed text-deep-teal ring-1 ring-secondary/20'}`}>
                              {missingCard ? 'Thiếu số thẻ' : 'Đủ thông tin'}
                            </span>
                            {!missingCard ? (
                              <p className="text-[11px] leading-5 text-slate-400">
                                {noteText
                                  ? 'Hồ sơ đã có ghi chú phục vụ rà soát.'
                                  : 'Sẵn sàng cho tra cứu và xuất dữ liệu.'}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.18)] transition-colors group-hover:bg-slate-50/90">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => onOpenModal('EDIT_PARTY_PROFILE', profile)}
                              className={`${tableActionButtonClass} hover:border-secondary/30 hover:bg-secondary-fixed hover:text-deep-teal`}
                              title="Chỉnh sửa hồ sơ Đảng viên"
                              aria-label={`Chỉnh sửa hồ sơ Đảng viên ${employee?.full_name || getProfileEmployeeCode(profile)}`}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 lg:hidden">
              {currentData.map((profile) => {
                const missingCard = isMissingPartyCard(profile);
                const noteText = String(profile.notes || '').trim();
                return (
                  <article key={profile.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">{profile.employee?.full_name || '--'}</h3>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {getProfileEmployeeCode(profile)}
                          {' • '}
                          {getDepartmentLabel(profile.employee, departments)}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${missingCard ? 'bg-tertiary-fixed text-tertiary ring-1 ring-tertiary/20' : 'bg-secondary-fixed text-deep-teal ring-1 ring-secondary/20'}`}>
                        {missingCard ? 'Thiếu số thẻ' : 'Đủ thông tin'}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50/80 p-3 text-xs text-slate-600">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Thông tin Đảng</p>
                        <div className="mt-2 space-y-1.5">
                          <p>Ngày sinh: {formatDateDdMmYyyy(profile.employee?.date_of_birth || null)}</p>
                          <p>Số thẻ: {profile.party_card_number || '--'}</p>
                          <p>Trình độ: {profile.professional_qualification || '--'}</p>
                          <p>LLCT: {profile.political_theory_level || '--'}</p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50/80 p-3 text-xs text-slate-600">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Quê quán và ghi chú</p>
                        <div className="mt-2 space-y-1.5">
                          <p>Quê quán: {profile.hometown || '--'}</p>
                          <p>Dân tộc: {profile.ethnicity || '--'}</p>
                          <p>Tôn giáo: {profile.religion || '--'}</p>
                          <p>Ghi chú: {noteText || '--'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {missingCard ? 'Cần bổ sung số thẻ trước khi xuất workbook.' : 'Hồ sơ sẵn sàng cho đối soát dữ liệu.'}
                      </span>
                      <button
                        onClick={() => onOpenModal('EDIT_PARTY_PROFILE', profile)}
                        className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                        Sửa hồ sơ
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <PaginationControls
          currentPage={currentPage}
          totalItems={totalItems}
          rowsPerPage={rowsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          onRowsPerPageChange={(rows) => {
            setRowsPerPage(rows);
            setCurrentPage(1);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          hidePageSummary
        />
      </div>
    </div>
  );
};
