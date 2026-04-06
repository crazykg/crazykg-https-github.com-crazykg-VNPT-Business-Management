import React, { useState, useMemo, useEffect } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import type { ModalType } from '../types';
import type { Department } from '../types/department';
import type { Employee } from '../types/employee';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface DepartmentListProps {
  departments: Department[];
  employees?: Employee[];
  onOpenModal: (type: ModalType, item?: Department) => void;
  canImport?: boolean;
}

type DepartmentTreeNode = Department & { children: DepartmentTreeNode[]; level: number };
type DepartmentTableRow = Department & { level: number; hasChildren: boolean; employeeCount: number };

// Helper to build tree structure
const buildTree = (depts: Department[]) => {
  const deptMap = new Map<string | number, DepartmentTreeNode>();
  
  // Initialize map
  depts.forEach(d => {
    deptMap.set(d.id, { ...d, children: [], level: 0 });
  });

  const roots: DepartmentTreeNode[] = [];

  // Build hierarchy
  depts.forEach(d => {
    const node = deptMap.get(d.id);
    if (!node) return;

    if (d.parent_id !== null && deptMap.has(d.parent_id)) {
      const parent = deptMap.get(d.parent_id);
      parent?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

// Helper to flatten tree for display (respecting expanded state)
const flattenTree = (
  nodes: DepartmentTreeNode[],
  expandedIds: Set<string | number>, 
  level = 0
): (Department & { level: number, hasChildren: boolean })[] => {
  let result: (Department & { level: number, hasChildren: boolean })[] = [];

  nodes.forEach(node => {
    result.push({ ...node, level, hasChildren: node.children.length > 0 });
    
    if (expandedIds.has(node.id) && node.children.length > 0) {
      result = result.concat(flattenTree(node.children, expandedIds, level + 1));
    }
  });

  return result;
};

export const DepartmentList: React.FC<DepartmentListProps> = ({ departments = [], employees = [], onOpenModal, canImport = false }: DepartmentListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);


  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      { value: 'ACTIVE', label: 'Đang hoạt động' },
      { value: 'INACTIVE', label: 'Ngừng hoạt động' },
    ],
    []
  );

  const defaultExpandedIds = useMemo(() => {
    const parentIds = new Set<string | number>();
    departments.forEach((dept) => {
      if (dept.parent_id !== null) {
        parentIds.add(dept.parent_id);
      }
    });
    return parentIds;
  }, [departments]);

  // Default state: expand all parent nodes on first load / data refresh.
  useEffect(() => {
    setExpandedIds(defaultExpandedIds);
  }, [defaultExpandedIds]);

  // While searching, expand all to show matches immediately.
  useEffect(() => {
    if (searchTerm.trim()) {
      setExpandedIds(new Set(departments.map((d) => d.id)));
      return;
    }
    if (!statusFilter) {
      setExpandedIds(defaultExpandedIds);
    }
  }, [searchTerm, statusFilter, departments, defaultExpandedIds]);

  const toggleExpand = (id: string | number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const employeeCountByDept = useMemo(() => {
    const counts = new Map<string, number>();

    (employees || []).forEach((employee) => {
      const rawDepartmentId = String(employee.department_id ?? employee.department ?? '').trim();
      if (!rawDepartmentId) {
        return;
      }

      const normalizedDepartment = departments.find(
        (department) =>
          String(department.id) === rawDepartmentId || department.dept_code === rawDepartmentId
      );

      const key = normalizedDepartment ? String(normalizedDepartment.id) : rawDepartmentId;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
  }, [employees, departments]);

  // Filter Data
  const filteredDepartments = useMemo(() => {
    return (departments || []).filter(dept => {
      const matchesSearch = 
        dept.dept_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        dept.dept_code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter 
        ? statusFilter === 'ACTIVE'
          ? dept.is_active
          : !dept.is_active
        : true;
      
      return matchesSearch && matchesStatus;
    });
  }, [departments, searchTerm, statusFilter]);

  // Build Tree & Flatten
  const tableData = useMemo<DepartmentTableRow[]>(() => {
    const baseRows: Array<Department & { level: number; hasChildren: boolean }> = (() => {
      // If searching or filtering, show flat list to ensure matches are visible.
      if (searchTerm || statusFilter) {
        return filteredDepartments.map(d => ({ ...d, level: 0, hasChildren: false }));
      }

      // Otherwise show tree.
      const roots = buildTree(filteredDepartments);
      return flattenTree(roots, expandedIds);
    })();

    return baseRows.map((dept) => ({
      ...dept,
      employeeCount: employeeCountByDept.get(String(dept.id)) || 0,
    }));
  }, [filteredDepartments, expandedIds, searchTerm, statusFilter, employeeCountByDept]);

  const totalItems = tableData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedTableData = tableData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Stats
  const activeCount = departments.filter(d => d.is_active).length;
  const inactiveCount = departments.length - activeCount;

  const getParentDepartmentCode = (department: Department): string => {
    if (department.parent_id === null || department.parent_id === undefined || department.parent_id === '') {
      return '';
    }
    const parent = departments.find((item) => String(item.id) === String(department.parent_id));
    return parent?.dept_code || String(department.parent_id);
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const headers = ['Mã phòng ban', 'Tên phòng ban', 'Mã phòng ban cha', 'Trạng thái'];
    const rootDepartmentCode =
      departments.find((department) => {
        const normalized = String(department.dept_code || '')
          .trim()
          .toUpperCase()
          .replace(/[\s_-]+/g, '');
        return normalized === 'BGĐVT' || normalized === 'BGDVT';
      })?.dept_code || 'BGĐVT';

    const sampleRows = [
      ['BGĐVT', 'Ban giám đốc Viễn Thông', '', 'ACTIVE'],
      ['PB011', 'Tổ giải pháp số', rootDepartmentCode, 'ACTIVE'],
      ['PB012', 'Tổ hỗ trợ vận hành', rootDepartmentCode, 'INACTIVE'],
    ];

    downloadExcelTemplate('mau_nhap_phong_ban', 'PhongBan', headers, sampleRows);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);

    const headers = ['Mã phòng ban', 'Tên phòng ban', 'Mã phòng ban cha', 'Số nhân sự', 'Trạng thái'];
    const rows = tableData.map((department) => [
      department.dept_code || '',
      department.dept_name || '',
      getParentDepartmentCode(department),
      department.employeeCount || 0,
      department.is_active ? 'ACTIVE' : 'INACTIVE',
    ]);
    const fileName = `ds_phong_ban_${isoDateStamp()}`;

    if (type === 'excel') {
      exportExcel(fileName, 'PhongBan', headers, rows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sach phong ban',
      headers,
      rows,
      subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      window.alert('Trinh duyet dang chan popup. Vui long cho phep popup de xuat PDF.');
    }
  };

  return (
    <div className="p-3 pb-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>business</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Quản lý Phòng ban</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Cơ cấu tổ chức theo mô hình cây phân cấp</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Import dropdown */}
          {canImport ? (
            <div className="relative">
              <button
                onClick={() => setShowImportMenu((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload</span>
                Nhập
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                  <div className="absolute top-full left-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                    <button
                      onClick={() => { setShowImportMenu(false); onOpenModal('IMPORT_DATA'); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload</span>
                      Nhập dữ liệu
                    </button>
                    <button
                      onClick={handleDownloadTemplate}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left border-t border-slate-100"
                    >
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>download</span>
                      Tải file mẫu
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>download</span>
              Xuất
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute top-full right-0 mt-1.5 w-36 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                  <button onClick={() => handleExport('excel')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>table_view</span> Excel
                  </button>
                  <button onClick={() => handleExport('csv')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left border-t border-slate-100">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>csv</span> CSV
                  </button>
                  <button onClick={() => handleExport('pdf')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left border-t border-slate-100">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Add button */}
          <button
            onClick={() => onOpenModal('ADD_DEPARTMENT')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 bg-primary text-white hover:bg-deep-teal shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            Thêm mới
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Tổng số</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>business</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{departments.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">phòng ban trong hệ thống</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Hoạt động</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-success" style={{ fontSize: 15 }}>check_circle</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{activeCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">đang vận hành</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Tạm ngưng</span>
            <div className="w-7 h-7 rounded bg-tertiary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 15 }}>cancel</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{inactiveCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">ngừng hoạt động</p>
        </div>
      </div>

      {/* ── Filter toolbar + Table ── */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã hoặc tên phòng ban..."
              className="w-full h-8 pl-7 pr-3 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none bg-white placeholder:text-slate-400"
            />
          </div>
          <div className="relative w-40">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ fontSize: 14 }}>filter_list</span>
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Tất cả trạng thái"
              triggerClassName="w-full h-8 pl-7 pr-7 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none bg-white text-slate-700"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mã PB</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[42%]">Tên phòng ban</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nhân sự</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedTableData.length > 0 ? (
                pagedTableData.map((dept) => (
                  <tr key={String(dept.id)} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-4 py-2 text-xs font-mono text-slate-500">{dept.dept_code}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center" style={{ paddingLeft: `${dept.level * 20}px` }}>
                        {dept.hasChildren && !searchTerm && !statusFilter ? (
                          <button
                            onClick={() => toggleExpand(dept.id)}
                            className="p-0.5 mr-1.5 text-slate-400 hover:text-primary rounded hover:bg-slate-100 transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                              {expandedIds.has(dept.id) ? 'expand_more' : 'chevron_right'}
                            </span>
                          </button>
                        ) : (
                          <span className="w-6 mr-1.5 inline-block" />
                        )}
                        <div className="flex flex-col">
                          <span className={`text-xs font-semibold ${dept.level === 0 ? 'text-slate-800' : 'text-slate-700'}`}>
                            {dept.dept_name}
                          </span>
                          {dept.parent_id && (searchTerm || statusFilter) && (
                            <span className="text-[10px] text-slate-400">
                              Thuộc: {departments.find((d) => String(d.id) === String(dept.parent_id))?.dept_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 14 }}>group</span>
                        <span className="text-xs font-medium text-slate-700">{dept.employeeCount || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${dept.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dept.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {dept.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => onOpenModal('EDIT_DEPARTMENT', dept)}
                          className="p-1 text-slate-400 hover:text-primary transition-colors rounded hover:bg-slate-100"
                          title="Chỉnh sửa"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                        <button
                          onClick={() => onOpenModal(dept.employeeCount && dept.employeeCount > 0 ? 'CANNOT_DELETE' : 'DELETE_DEPARTMENT', dept)}
                          className="p-1 text-slate-400 hover:text-error transition-colors rounded hover:bg-red-50"
                          title="Xóa"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 32 }}>search</span>
                      <p className="text-xs text-slate-500">Không tìm thấy phòng ban nào phù hợp.</p>
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
          onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
};
