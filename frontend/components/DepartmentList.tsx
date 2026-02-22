import React, { useState, useMemo, useEffect } from 'react';
import { Department, ModalType } from '../types';
import { PaginationControls } from './PaginationControls';
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
  onOpenModal: (type: ModalType, item?: Department) => void;
}

type DepartmentTreeNode = Department & { children: DepartmentTreeNode[]; level: number };

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

export const DepartmentList: React.FC<DepartmentListProps> = ({ departments = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
  const tableData = useMemo(() => {
    // If searching or filtering, show flat list to ensure matches are visible
    if (searchTerm || statusFilter) {
      return filteredDepartments.map(d => ({ ...d, level: 0, hasChildren: false }));
    }

    // Otherwise show tree
    const roots = buildTree(filteredDepartments);
    return flattenTree(roots, expandedIds);
  }, [filteredDepartments, expandedIds, searchTerm, statusFilter]);

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
          <button 
            onClick={() => onOpenModal('IMPORT_DATA')}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
          >
            <Upload className="w-5 h-5" />
            <span className="hidden sm:inline">Nhập</span>
          </button>
          <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm">
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Xuất</span>
          </button>
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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="w-4 h-4 text-slate-400" />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer transition-all"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[40%]">Tên phòng ban</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã PB</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân sự</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedTableData.length > 0 ? (
                  pagedTableData.map((dept) => (
                    <tr key={dept.dept_code} className="hover:bg-slate-50 transition-colors group">
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
                              <span className="text-xs text-slate-400">Thuộc: {departments.find(d => d.id === dept.parent_id)?.dept_name}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-500">{dept.dept_code}</td>
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
