import React, { useEffect, useMemo, useState } from 'react';
import type { Department, Employee, EmployeePartyListItem, ModalType, PaginatedQuery, PaginationMeta } from '../types';
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

export const EmployeePartyList: React.FC<EmployeePartyListProps> = ({
  partyProfiles = [],
  employees = [],
  departments = [],
  onOpenModal,
  onNotify,
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

  const sortedDepartments = useMemo(
    () => [...departments].sort((left, right) => `${left.dept_code} ${left.dept_name}`.localeCompare(`${right.dept_code} ${right.dept_name}`, 'vi')),
    [departments]
  );

  const departmentFilterOptions = useMemo(
    () => [
      { value: '', label: 'Phòng ban' },
      ...sortedDepartments.map((department) => ({
        value: String(department.id),
        label: `${department.dept_code} - ${department.dept_name}`,
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

  const kpis = paginationMeta?.kpis || {};
  const cards = [
    { label: 'Tổng đảng viên', value: kpis.total_party_members ?? filteredProfiles.length, tone: 'bg-slate-900 text-white' },
    {
      label: 'Có số thẻ Đảng',
      value: (kpis.total_party_members ?? filteredProfiles.length) - (kpis.missing_party_card_number_count ?? filteredProfiles.filter((item) => !String(item.party_card_number || '').trim()).length),
      tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    },
    { label: 'Thiếu số thẻ Đảng', value: kpis.missing_party_card_number_count ?? filteredProfiles.filter((item) => !String(item.party_card_number || '').trim()).length, tone: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
  ];

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
    <div className="p-4 pb-20 md:p-8 md:pb-8">
      <header className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-deep-teal">Quản lý Đảng viên</h2>
          <p className="mt-1 text-sm text-slate-500">Theo dõi hồ sơ đảng viên gắn với nhân sự nội bộ.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowImportMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span>Nhập</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>

            {showImportMenu ? (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <button
                    onClick={() => {
                      setShowImportMenu(false);
                      onOpenModal('IMPORT_DATA');
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-lg">upload_file</span>
                    Nhập danh sách
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-green-600"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Tải file mẫu
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Xuất</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>

            {showExportMenu ? (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <button onClick={() => handleExport('excel')} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-green-600">
                    <span className="material-symbols-outlined text-lg">table_view</span>
                    Excel
                  </button>
                  <button onClick={() => handleExport('csv')} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-blue-600">
                    <span className="material-symbols-outlined text-lg">csv</span>
                    CSV
                  </button>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-red-600">
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                    PDF
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <button
            onClick={() => onOpenModal('ADD_PARTY_PROFILE')}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-deep-teal"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm hồ sơ Đảng viên</span>
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-2xl px-4 py-4 ${card.tone}`}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">{card.label}</p>
            <p className="mt-3 text-2xl font-black">{card.value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1fr),220px,220px]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 w-full rounded-lg bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none ring-0 transition placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20"
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
              triggerClassName="h-11 w-full rounded-lg bg-slate-50 px-3 text-sm text-slate-700"
            />

            <SearchableSelect
              value={qualityFilter}
              onChange={(value) => {
                setQualityFilter(value);
                setCurrentPage(1);
              }}
              options={QUALITY_OPTIONS}
              placeholder="Thiếu thông tin"
              triggerClassName="h-11 w-full rounded-lg bg-slate-50 px-3 text-sm text-slate-700"
            />
          </div>
        </div>

        {currentData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300">{isLoading ? 'hourglass_top' : 'badge'}</span>
            <h3 className="text-lg font-bold text-slate-900">
              {isLoading
                ? 'Đang tải hồ sơ đảng viên...'
                : partyProfiles.length === 0 && !searchTerm && !departmentFilter && !qualityFilter
                  ? 'Chưa có hồ sơ đảng viên'
                  : 'Không tìm thấy đảng viên phù hợp'}
            </h3>
            {!isLoading ? (
              <p className="max-w-xl text-sm text-slate-500">
                Tạo hồ sơ đầu tiên hoặc tải file mẫu để chuẩn hóa workbook trước khi import danh sách.
              </p>
            ) : null}
            {!isLoading ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Tải file mẫu
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal('ADD_PARTY_PROFILE')}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-deep-teal"
                >
                  Thêm hồ sơ đầu tiên
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1400px] w-full border-collapse text-left">
                <thead className="border-y border-slate-200 bg-slate-50">
                  <tr>
                    {['MÃ NV', 'HỌ TÊN', 'PHÒNG BAN', 'NGÀY SINH', 'SỐ THẺ', 'QUÊ QUÁN', 'DÂN TỘC', 'TÔN GIÁO', 'TRÌNH ĐỘ', 'LLCT', 'GHI CHÚ', 'CHẤT LƯỢNG'].map((label) => (
                      <th key={label} className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="text-deep-teal">{label}</span>
                      </th>
                    ))}
                    <th className="sticky right-0 bg-slate-50 px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.35)]">
                      THAO TÁC
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentData.map((profile) => {
                    const employee = profile.employee;
                    const missingCard = Boolean(profile.profile_quality?.missing_card_number) || !String(profile.party_card_number || '').trim();

                    return (
                      <tr key={profile.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-sm font-bold text-slate-500">{getProfileEmployeeCode(profile)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{employee?.full_name || '--'}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{getDepartmentLabel(employee, departments)}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{formatDateDdMmYyyy(employee?.date_of_birth || null)}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{profile.party_card_number || '--'}</td>
                        <td className="max-w-[240px] px-4 py-4 text-sm text-slate-600">{profile.hometown || '--'}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{profile.ethnicity || '--'}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{profile.religion || '--'}</td>
                        <td className="max-w-[220px] px-4 py-4 text-sm text-slate-600">{profile.professional_qualification || '--'}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{profile.political_theory_level || '--'}</td>
                        <td className="max-w-[260px] px-4 py-4 text-sm text-slate-600">{profile.notes || '--'}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {missingCard ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Thiếu số thẻ</span> : null}
                            {!missingCard ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">Đủ thông tin</span> : null}
                          </div>
                        </td>
                        <td className="sticky right-0 bg-white px-4 py-4 text-right shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.35)]">
                          <button
                            onClick={() => onOpenModal('EDIT_PARTY_PROFILE', profile)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                            Sửa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {currentData.map((profile) => (
                <article key={profile.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{profile.employee?.full_name || '--'}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {getProfileEmployeeCode(profile)}
                        {' • '}
                        {getDepartmentLabel(profile.employee, departments)}
                      </p>
                    </div>
                    {profile.party_card_number ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        Có số thẻ
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                        Thiếu số thẻ
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>Số thẻ: {profile.party_card_number || '--'}</p>
                    <p>Quê quán: {profile.hometown || '--'}</p>
                    <p>Ghi chú: {profile.notes || '--'}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-end">
                    <button
                      onClick={() => onOpenModal('EDIT_PARTY_PROFILE', profile)}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      Sửa hồ sơ
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
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
        />
      </div>
    </div>
  );
};
