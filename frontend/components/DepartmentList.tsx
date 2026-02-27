import React, { useState, useMemo, useEffect } from 'react';
import { Department, Employee, ModalType } from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Users, 
  Building2, 
  CheckCircle, 
  XCircle,
  Upload,
  Download
} from 'lucide-react';

interface DepartmentListProps {
  departments: Department[];
  employees?: Employee[];
  onOpenModal: (type: ModalType, item?: Department) => void;
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

export const DepartmentList: React.FC<DepartmentListProps> = ({ departments = [], employees = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

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
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            Quản lý Phòng ban
          </h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý cơ cấu tổ chức theo mô hình cây phân cấp.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => setShowImportMenu((prev) => !prev)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Nhập</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button
                    onClick={() => {
                      setShowImportMenu(false);
                      onOpenModal('IMPORT_DATA');
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
                  >
                    <Upload className="w-4 h-4" />
                    Nhập dữ liệu
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left border-t border-slate-100"
                  >
                    <Download className="w-4 h-4" />
                    Tải file mẫu
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Xuất</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button
                    onClick={() => handleExport('excel')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-lg">table_view</span> Excel
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">csv</span> CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => onOpenModal('ADD_DEPARTMENT')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng số</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{departments.length}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Hoạt động</p>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Ngừng hoạt động</p>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{inactiveCount}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="animate-fade-in">
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm mã hoặc tên phòng ban..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none transition-all"
            />
          </div>
          <div className="w-full md:w-48 relative">
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Tất cả trạng thái"
              triggerClassName="w-full pl-9 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none cursor-pointer transition-all"
            />
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <Filter className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã PB</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[40%]">Tên phòng ban</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân sự</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedTableData.length > 0 ? (
                  pagedTableData.map((dept) => (
                    <tr key={String(dept.id)} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-3 text-sm font-mono text-slate-500">{dept.dept_code}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center" style={{ paddingLeft: `${dept.level * 24}px` }}>
                          {dept.hasChildren && !searchTerm && !statusFilter ? (
                            <button 
                              onClick={() => toggleExpand(dept.id)}
                              className="p-1 mr-2 text-slate-400 hover:text-primary rounded hover:bg-slate-200 transition-colors"
                            >
                              {expandedIds.has(dept.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-6 h-6 mr-2 inline-block"></span>
                          )}
                          <div className="flex flex-col">
                            <span className={`font-semibold text-sm ${dept.level === 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                              {dept.dept_name}
                            </span>
                            {dept.parent_id && (searchTerm || statusFilter) && (
                              <span className="text-xs text-slate-400">Thuộc: {departments.find(d => String(d.id) === String(dept.parent_id))?.dept_name}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">{dept.employeeCount || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium gap-1.5 ${dept.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dept.is_active ? 'bg-green-600' : 'bg-slate-500'}`}></span>
                          {dept.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => onOpenModal('EDIT_DEPARTMENT', dept)}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded hover:bg-slate-100"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onOpenModal(dept.employeeCount && dept.employeeCount > 0 ? 'CANNOT_DELETE' : 'DELETE_DEPARTMENT', dept)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded hover:bg-red-50"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="w-10 h-10 text-slate-300" />
                        <p>Không tìm thấy phòng ban nào phù hợp.</p>
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
          />
        </div>
      </div>
    </div>
  );
};
