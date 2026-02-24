import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DepartmentList } from './components/DepartmentList';
import { BusinessList } from './components/BusinessList';
import { VendorList } from './components/VendorList';
import { ProductList } from './components/ProductList';
import { CustomerList } from './components/CustomerList';
import { CusPersonnelList } from './components/CusPersonnelList';
import { OpportunityList } from './components/OpportunityList';
import { ProjectList } from './components/ProjectList';
import { ContractList } from './components/ContractList';
import { DocumentList } from './components/DocumentList';
import { ReminderList } from './components/ReminderList';
import { UserDeptHistoryList } from './components/UserDeptHistoryList';
import { AuditLogList } from './components/AuditLogList';
import { SupportRequestList } from './components/SupportRequestList';
import { Dashboard } from './components/Dashboard';
import { InternalUserModuleTabs, type InternalUserSubTab } from './components/InternalUserModuleTabs';
import { ToastContainer } from './components/Toast';
import { 
  DepartmentFormModal, 
  ViewDepartmentModal, 
  DeleteWarningModal, 
  CannotDeleteModal, 
  ImportModal,
  EmployeeFormModal,
  DeleteEmployeeModal,
  BusinessFormModal,
  DeleteBusinessModal,
  VendorFormModal,
  DeleteVendorModal,
  ProductFormModal,
  DeleteProductModal,
  CustomerFormModal,
  DeleteCustomerModal,
  CusPersonnelFormModal,
  DeleteCusPersonnelModal,
  OpportunityFormModal,
  DeleteOpportunityModal,
  ProjectFormModal,
  DeleteProjectModal,
  DeleteContractModal,
  DocumentFormModal,
  DeleteDocumentModal,
  ReminderFormModal,
  DeleteReminderModal,
  UserDeptHistoryFormModal,
  DeleteUserDeptHistoryModal,
  type ImportPayload
} from './components/Modals';
import { ContractModal } from './components/ContractModal';
import { AuditLog, Department, Employee, Business, Vendor, Product, Customer, CustomerPersonnel, Opportunity, Project, ProjectItemMaster, Contract, Document, Reminder, UserDeptHistory, ModalType, Toast, DashboardStats, OpportunityStage, ProjectStatus, PaymentSchedule, HRStatistics, SupportRequest, SupportServiceGroup, SupportRequestStatus, SupportRequestHistory } from './types';
import { buildHrStatistics } from './utils/hrAnalytics';
import {
  createContract,
  createCustomer,
  createDepartment,
  createEmployee,
  createOpportunity,
  createProject,
  createSupportServiceGroup,
  createSupportRequest,
  createVendor,
  deleteContract,
  deleteCustomer,
  deleteDepartment,
  deleteEmployee,
  deleteOpportunity,
  deleteProject,
  deleteSupportRequest,
  deleteVendor,
  fetchSupportRequestHistories,
  fetchSupportRequestHistory,
  fetchPaymentSchedules,
  fetchV5MasterData,
  generateContractPayments,
  updateContract,
  updateCustomer,
  updateDepartment,
  updateEmployee,
  updatePaymentSchedule,
  updateOpportunity,
  updateProject,
  updateSupportRequest,
  updateSupportRequestStatus,
  updateVendor
} from './services/v5Api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [internalUserSubTab, setInternalUserSubTab] = useState<InternalUserSubTab>('dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cusPersonnel, setCusPersonnel] = useState<CustomerPersonnel[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectItemMaster[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userDeptHistory, setUserDeptHistory] = useState<UserDeptHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [supportServiceGroups, setSupportServiceGroups] = useState<SupportServiceGroup[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportRequestHistories, setSupportRequestHistories] = useState<SupportRequestHistory[]>([]);
  
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCusPersonnel, setSelectedCusPersonnel] = useState<CustomerPersonnel | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [selectedUserDeptHistory, setSelectedUserDeptHistory] = useState<UserDeptHistory | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPaymentScheduleLoading, setIsPaymentScheduleLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const data = await fetchV5MasterData();

        setDepartments(data.departments || []);
        setEmployees(data.employees || []);
        setBusinesses(data.businesses || []);
        setProducts(data.products || []);
        setCustomers(data.customers || []);
        setCusPersonnel(data.customerPersonnel || []);
        setVendors(data.vendors || []);
        setProjects(data.projects || []);
        setProjectItems(data.projectItems || []);
        setContracts(data.contracts || []);
        setPaymentSchedules(data.paymentSchedules || []);
        setOpportunities(data.opportunities || []);
        setDocuments(data.documents || []);
        setReminders(data.reminders || []);
        setUserDeptHistory(data.userDeptHistory || []);
        setAuditLogs(data.auditLogs || []);
        setSupportServiceGroups(data.supportServiceGroups || []);
        setSupportRequests(data.supportRequests || []);
        setSupportRequestHistories(data.supportRequestHistories || []);
      } catch {
        // API unavailable: keep empty state for strict v5 mode.
      }
    };

    bootstrap();
  }, []);

  // Helper to add toast
  const addToast = (type: 'success' | 'error', title: string, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => (prev || []).filter(t => t.id !== id));
  };

  const normalizeImportToken = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  const buildHeaderIndex = (headers: string[]): Map<string, number> => {
    const indexMap = new Map<string, number>();
    (headers || []).forEach((header, index) => {
      const normalized = normalizeImportToken(header);
      if (normalized && !indexMap.has(normalized)) {
        indexMap.set(normalized, index);
      }
    });
    return indexMap;
  };

  const getImportCell = (
    row: string[],
    headerIndex: Map<string, number>,
    aliases: string[]
  ): string => {
    for (const alias of aliases) {
      const columnIndex = headerIndex.get(alias);
      if (columnIndex !== undefined) {
        return String(row[columnIndex] ?? '').trim();
      }
    }
    return '';
  };

  const normalizeStatusActive = (value: string): boolean => {
    const token = normalizeImportToken(value);
    if (!token) return true;
    if (['active', 'hoatdong', '1', 'true', 'yes', 'co'].includes(token)) return true;
    if (['inactive', 'khonghoatdong', 'ngunghoatdong', '0', 'false', 'no', 'khong'].includes(token)) return false;
    return true;
  };

  const normalizeEmployeeStatusImport = (value: string): Employee['status'] => {
    const token = normalizeImportToken(value);
    if (['active', 'hoatdong'].includes(token)) return 'ACTIVE';
    if (['suspended', 'transferred', 'luanchuyen'].includes(token)) return 'SUSPENDED';
    if (['inactive', 'khonghoatdong', '0', 'khong'].includes(token)) return 'INACTIVE';
    return 'ACTIVE';
  };

  const normalizeGenderImport = (value: string): Employee['gender'] => {
    const token = normalizeImportToken(value);
    if (['male', 'nam', 'm'].includes(token)) return 'MALE';
    if (['female', 'nu', 'f'].includes(token)) return 'FEMALE';
    if (['other', 'khac', 'o'].includes(token)) return 'OTHER';
    return null;
  };

  const normalizeVpnImport = (value: string): Employee['vpn_status'] => {
    const token = normalizeImportToken(value);
    if (['yes', 'co', '1', 'true'].includes(token)) return 'YES';
    return 'NO';
  };

  const normalizeSupportPriorityImport = (value: string): SupportRequest['priority'] => {
    const token = normalizeImportToken(value);
    if (['urgent', 'khan', 'khancap'].includes(token)) return 'URGENT';
    if (['high', 'cao'].includes(token)) return 'HIGH';
    if (['medium', 'trungbinh', 'tb'].includes(token)) return 'MEDIUM';
    if (['low', 'thap'].includes(token)) return 'LOW';
    return 'MEDIUM';
  };

  const normalizeSupportStatusImport = (value: string): SupportRequest['status'] => {
    const token = normalizeImportToken(value);
    if (['open', 'mo', 'new'].includes(token)) return 'OPEN';
    if (['hotfixing', 'hotfix', 'danghotfix'].includes(token)) return 'HOTFIXING';
    if (['resolved', 'daxuly', 'hoanthanh'].includes(token)) return 'RESOLVED';
    if (['deployed', 'datrienkhai', 'trienkhai'].includes(token)) return 'DEPLOYED';
    if (['pending', 'tamdung', 'choduyet'].includes(token)) return 'PENDING';
    if (['cancelled', 'cancel', 'huy'].includes(token)) return 'CANCELLED';
    return 'OPEN';
  };

  const normalizeImportDate = (value: string): string | null => {
    const text = String(value || '').trim();
    if (!text) return null;

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() + 1 === month &&
        date.getUTCDate() === day
      ) {
        return text;
      }
      return null;
    }

    const dmyMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() + 1 === month &&
        date.getUTCDate() === day
      ) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric > 0) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + numeric * 86400000);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      if (year >= 1900 && year <= 9999) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    return null;
  };

  const summarizeImportResult = (
    moduleLabel: string,
    successCount: number,
    failures: string[]
  ) => {
    if (successCount > 0) {
      addToast('success', 'Nhập dữ liệu', `${moduleLabel}: đã lưu ${successCount} dòng.`);
    }

    if (failures.length > 0) {
      const preview = failures.slice(0, 2).join(' | ');
      const suffix = failures.length > 2 ? ` (+${failures.length - 2} lỗi khác)` : '';
      addToast('error', 'Nhập dữ liệu', `${moduleLabel}: ${preview}${suffix}`);
    }
  };

  const handleImportData = async (payload: ImportPayload) => {
    setIsSaving(true);
    try {
      const moduleToken = normalizeImportToken(payload.moduleKey);
      const headerIndex = buildHeaderIndex(payload.headers || []);
      const rows = payload.rows || [];

      if (moduleToken === 'departments') {
        const deptByCode = new Map<string, Department>();
        (departments || []).forEach((department) => {
          const codeToken = normalizeImportToken(department.dept_code);
          if (codeToken) {
            deptByCode.set(codeToken, department);
          }
        });

        const entries: Array<{
          rowNumber: number;
          deptCode: string;
          deptCodeToken: string;
          deptName: string;
          parentCodeToken: string;
          parentCodeRaw: string;
          isActive: boolean;
        }> = [];
        const failures: string[] = [];

        rows.forEach((row, rowIndex) => {
          const rowNumber = rowIndex + 2;
          const deptCode = getImportCell(row, headerIndex, ['maphongban', 'mapb', 'deptcode', 'departmentcode', 'code']);
          const deptName = getImportCell(row, headerIndex, ['tenphongban', 'departmentname', 'deptname', 'name']);
          const parentCodeRaw = getImportCell(row, headerIndex, ['maphongbancha', 'mapbcha', 'parentcode', 'parentdeptcode', 'parent']);
          const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status', 'isactive']);

          if (!(deptCode || deptName || parentCodeRaw || statusRaw)) {
            return;
          }

          if (!deptCode || !deptName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã phòng ban hoặc Tên phòng ban.`);
            return;
          }

          entries.push({
            rowNumber,
            deptCode,
            deptCodeToken: normalizeImportToken(deptCode),
            deptName,
            parentCodeToken: normalizeImportToken(parentCodeRaw),
            parentCodeRaw,
            isActive: normalizeStatusActive(statusRaw),
          });
        });

        const createdItems: Department[] = [];
        const pending = [...entries];
        let guard = pending.length + 5;

        while (pending.length > 0 && guard > 0) {
          let hasProgress = false;

          for (let i = 0; i < pending.length; i += 1) {
            const entry = pending[i];

            if (!entry.deptCodeToken) {
              failures.push(`Dòng ${entry.rowNumber}: Mã phòng ban không hợp lệ.`);
              pending.splice(i, 1);
              i -= 1;
              hasProgress = true;
              continue;
            }

            if (deptByCode.has(entry.deptCodeToken)) {
              failures.push(`Dòng ${entry.rowNumber}: Mã phòng ban "${entry.deptCode}" đã tồn tại.`);
              pending.splice(i, 1);
              i -= 1;
              hasProgress = true;
              continue;
            }

            const parentDept = entry.parentCodeToken ? deptByCode.get(entry.parentCodeToken) : null;
            if (entry.parentCodeToken && !parentDept) {
              continue;
            }

            try {
              const created = await createDepartment({
                dept_code: entry.deptCode,
                dept_name: entry.deptName,
                parent_id: parentDept ? parentDept.id : null,
                is_active: entry.isActive,
              });
              createdItems.push(created);
              deptByCode.set(entry.deptCodeToken, created);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Lỗi không xác định';
              failures.push(`Dòng ${entry.rowNumber}: ${message}`);
            }

            pending.splice(i, 1);
            i -= 1;
            hasProgress = true;
          }

          if (!hasProgress) {
            pending.forEach((entry) => {
              failures.push(`Dòng ${entry.rowNumber}: không tìm thấy phòng ban cha "${entry.parentCodeRaw}".`);
            });
            break;
          }

          guard -= 1;
        }

        if (createdItems.length > 0) {
          setDepartments((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Phòng ban', createdItems.length, failures);
        if (createdItems.length > 0) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'employees' || moduleToken === 'internaluserlist') {
        const deptByCode = new Map<string, Department>();
        (departments || []).forEach((department) => {
          const codeToken = normalizeImportToken(department.dept_code);
          if (codeToken) {
            deptByCode.set(codeToken, department);
          }
        });

        const createdItems: Employee[] = [];
        const failures: string[] = [];

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;

          const employeeCode = getImportCell(row, headerIndex, ['manv', 'manhanvien', 'usercode', 'employeecode', 'code']);
          const username = getImportCell(row, headerIndex, ['tendangnhap', 'username', 'login']);
          const fullName = getImportCell(row, headerIndex, ['hovaten', 'hoten', 'fullname', 'name']);
          const email = getImportCell(row, headerIndex, ['email']);
          const departmentCodeRaw = getImportCell(row, headerIndex, ['maphongban', 'mapb', 'departmentcode', 'deptcode']);
          const positionCode = getImportCell(row, headerIndex, ['machucvu', 'positioncode', 'positionid', 'chucvu']);
          const jobTitle = getImportCell(row, headerIndex, ['chucdanhtv', 'chucdanh', 'jobtitle', 'jobtitletv']);
          const dateOfBirthRaw = getImportCell(row, headerIndex, ['ngaysinh', 'dateofbirth', 'dob']);
          const genderRaw = getImportCell(row, headerIndex, ['gioitinh', 'gender']);
          const vpnRaw = getImportCell(row, headerIndex, ['vpn', 'vpnstatus']);
          const ipAddress = getImportCell(row, headerIndex, ['diachiip', 'ipaddress', 'ip']);
          const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status']);

          if (
            !employeeCode &&
            !username &&
            !fullName &&
            !email &&
            !departmentCodeRaw &&
            !positionCode &&
            !jobTitle &&
            !dateOfBirthRaw &&
            !genderRaw &&
            !vpnRaw &&
            !ipAddress &&
            !statusRaw
          ) {
            continue;
          }

          if (!employeeCode || !fullName || !email) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã NV, Họ và tên hoặc Email.`);
            continue;
          }

          const departmentCode = normalizeImportToken(departmentCodeRaw);
          const department = departmentCode ? deptByCode.get(departmentCode) : null;
          if (!department) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy phòng ban "${departmentCodeRaw}".`);
            continue;
          }

          const normalizedDate = normalizeImportDate(dateOfBirthRaw);
          if (dateOfBirthRaw && !normalizedDate) {
            failures.push(`Dòng ${rowNumber}: ngày sinh "${dateOfBirthRaw}" không đúng định dạng.`);
            continue;
          }

          try {
            const created = await createEmployee({
              user_code: employeeCode,
              username: username || employeeCode.toLowerCase(),
              full_name: fullName,
              email,
              department_id: department.id,
              position_id: positionCode || null,
              job_title_raw: jobTitle || null,
              date_of_birth: normalizedDate,
              gender: normalizeGenderImport(genderRaw),
              vpn_status: normalizeVpnImport(vpnRaw),
              ip_address: ipAddress || null,
              status: normalizeEmployeeStatusImport(statusRaw),
            });
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (createdItems.length > 0) {
          setEmployees((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Nhân sự', createdItems.length, failures);
        if (createdItems.length > 0) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'businesses') {
        const failures: string[] = [];
        const createdItems: Business[] = [];
        const existingCodes = new Set((businesses || []).map((item) => normalizeImportToken(item.domain_code)));
        const today = new Date().toISOString().split('T')[0];

        rows.forEach((row, rowIndex) => {
          const rowNumber = rowIndex + 2;
          const domainCode = getImportCell(row, headerIndex, ['malinhvuc', 'domaincode', 'businesscode', 'code']);
          const domainName = getImportCell(row, headerIndex, ['tenlinhvuc', 'domainname', 'businessname', 'name']);

          if (!domainCode && !domainName) {
            return;
          }

          if (!domainCode || !domainName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã lĩnh vực hoặc Tên lĩnh vực.`);
            return;
          }

          const codeToken = normalizeImportToken(domainCode);
          if (!codeToken || existingCodes.has(codeToken)) {
            failures.push(`Dòng ${rowNumber}: Mã lĩnh vực "${domainCode}" đã tồn tại.`);
            return;
          }

          existingCodes.add(codeToken);
          createdItems.push({
            id: domainCode,
            domain_code: domainCode,
            domain_name: domainName,
            created_at: today,
          });
        });

        if (createdItems.length > 0) {
          setBusinesses((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Lĩnh vực', createdItems.length, failures);
        if (createdItems.length > 0) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'vendors') {
        const failures: string[] = [];
        const createdItems: Vendor[] = [];

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const vendorCode = getImportCell(row, headerIndex, ['madoitac', 'vendorcode', 'code']);
          const vendorName = getImportCell(row, headerIndex, ['tendoitac', 'vendorname', 'name']);

          if (!vendorCode && !vendorName) {
            continue;
          }
          if (!vendorCode || !vendorName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã đối tác hoặc Tên đối tác.`);
            continue;
          }

          try {
            const created = await createVendor({
              vendor_code: vendorCode,
              vendor_name: vendorName,
            });
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (createdItems.length > 0) {
          setVendors((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Đối tác', createdItems.length, failures);
        if (createdItems.length > 0) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'products') {
        const failures: string[] = [];
        const createdItems: Product[] = [];
        const existingCodes = new Set((products || []).map((item) => normalizeImportToken(item.product_code)));
        const businessByCode = new Map<string, Business>();
        const vendorByCode = new Map<string, Vendor>();
        const today = new Date().toISOString().split('T')[0];

        (businesses || []).forEach((business) => {
          const key = normalizeImportToken(business.domain_code);
          if (key) businessByCode.set(key, business);
        });

        (vendors || []).forEach((vendor) => {
          const key = normalizeImportToken(vendor.vendor_code);
          if (key) vendorByCode.set(key, vendor);
        });

        rows.forEach((row, rowIndex) => {
          const rowNumber = rowIndex + 2;
          const productCode = getImportCell(row, headerIndex, ['masanpham', 'productcode', 'code']);
          const productName = getImportCell(row, headerIndex, ['tensanpham', 'productname', 'name']);
          const domainCodeRaw = getImportCell(row, headerIndex, ['malinhvuc', 'madomain', 'domaincode']);
          const vendorCodeRaw = getImportCell(row, headerIndex, ['manhacungcap', 'madoitac', 'vendorcode']);

          if (!productCode && !productName && !domainCodeRaw && !vendorCodeRaw) {
            return;
          }

          if (!productCode || !productName || !domainCodeRaw || !vendorCodeRaw) {
            failures.push(`Dòng ${rowNumber}: thiếu thông tin bắt buộc (Mã/Tên sản phẩm, Mã lĩnh vực, Mã nhà cung cấp).`);
            return;
          }

          const productCodeToken = normalizeImportToken(productCode);
          if (!productCodeToken || existingCodes.has(productCodeToken)) {
            failures.push(`Dòng ${rowNumber}: Mã sản phẩm "${productCode}" đã tồn tại.`);
            return;
          }

          const business = businessByCode.get(normalizeImportToken(domainCodeRaw));
          if (!business) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy lĩnh vực "${domainCodeRaw}".`);
            return;
          }

          const vendor = vendorByCode.get(normalizeImportToken(vendorCodeRaw));
          if (!vendor) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy nhà cung cấp "${vendorCodeRaw}".`);
            return;
          }

          existingCodes.add(productCodeToken);
          createdItems.push({
            id: productCode,
            product_code: productCode,
            product_name: productName,
            domain_id: business.id,
            vendor_id: vendor.id,
            standard_price: 0,
            unit: 'Cái/Gói',
            created_at: today,
          });
        });

        if (createdItems.length > 0) {
          setProducts((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Sản phẩm', createdItems.length, failures);
        if (createdItems.length > 0) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'clients') {
        const failures: string[] = [];
        const createdItems: Customer[] = [];

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const customerCode = getImportCell(row, headerIndex, ['makhachhang', 'customercode', 'code']);
          const customerName = getImportCell(row, headerIndex, ['tenkhachhang', 'customername', 'name']);
          const taxCode = getImportCell(row, headerIndex, ['masothue', 'taxcode']);
          const address = getImportCell(row, headerIndex, ['diachi', 'address']);

          if (!customerCode && !customerName && !taxCode && !address) {
            continue;
          }
          if (!customerCode || !customerName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã khách hàng hoặc Tên khách hàng.`);
            continue;
          }

          try {
            const created = await createCustomer({
              customer_code: customerCode,
              customer_name: customerName,
              tax_code: taxCode,
              address,
            });
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (createdItems.length > 0) {
          setCustomers((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Khách hàng', createdItems.length, failures);
        if (createdItems.length > 0) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'supportrequests') {
        const failures: string[] = [];
        const createdItems: SupportRequest[] = [];

        const customerByToken = new Map<string, Customer>();
        (customers || []).forEach((customer) => {
          customerByToken.set(normalizeImportToken(customer.customer_code), customer);
          customerByToken.set(normalizeImportToken(customer.customer_name), customer);
          customerByToken.set(normalizeImportToken(customer.id), customer);
        });

        const projectByToken = new Map<string, Project>();
        (projects || []).forEach((project) => {
          projectByToken.set(normalizeImportToken(project.project_code), project);
          projectByToken.set(normalizeImportToken(project.project_name), project);
          projectByToken.set(normalizeImportToken(project.id), project);
        });

        const productByToken = new Map<string, Product>();
        (products || []).forEach((product) => {
          productByToken.set(normalizeImportToken(product.product_code), product);
          productByToken.set(normalizeImportToken(product.product_name), product);
          productByToken.set(normalizeImportToken(product.id), product);
        });

        const groupByToken = new Map<string, SupportServiceGroup>();
        (supportServiceGroups || []).forEach((group) => {
          groupByToken.set(normalizeImportToken(group.group_name), group);
          groupByToken.set(normalizeImportToken(group.id), group);
        });

        const employeeByToken = new Map<string, Employee>();
        (employees || []).forEach((employee) => {
          const code = employee.employee_code || employee.user_code || employee.username;
          employeeByToken.set(normalizeImportToken(code), employee);
          employeeByToken.set(normalizeImportToken(employee.username), employee);
          employeeByToken.set(normalizeImportToken(employee.full_name), employee);
          employeeByToken.set(normalizeImportToken(employee.id), employee);
        });

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const ticketCode = getImportCell(row, headerIndex, ['ticket', 'maticket', 'ticketcode', 'jiracode']);
          const summary = getImportCell(row, headerIndex, ['noidungyeucau', 'summary', 'noidung', 'yeucau']);
          const customerRaw = getImportCell(row, headerIndex, ['donviyeucau', 'khachhang', 'makhachhang', 'customercode', 'customer']);
          const serviceGroupRaw = getImportCell(row, headerIndex, ['nhomhotro', 'servicegroup', 'supportgroup', 'group']);
          const assigneeRaw = getImportCell(row, headerIndex, ['nguoixuly', 'assignee', 'assigneecode', 'assigneeid', 'manv', 'usercode']);
          const projectRaw = getImportCell(row, headerIndex, ['duan', 'project', 'projectcode', 'maduan']);
          const productRaw = getImportCell(row, headerIndex, ['sanpham', 'product', 'productcode', 'masanpham']);
          const reporterName = getImportCell(row, headerIndex, ['nguoibao', 'reporter', 'reportername']);
          const priorityRaw = getImportCell(row, headerIndex, ['uutien', 'priority']);
          const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status']);
          const requestedDateRaw = getImportCell(row, headerIndex, ['ngaynhanyeucau', 'requesteddate', 'ngaynhan']);
          const dueDateRaw = getImportCell(row, headerIndex, ['hanhoanthanh', 'duedate', 'hanxuly']);
          const resolvedDateRaw = getImportCell(row, headerIndex, ['ngayhoanthanh', 'resolveddate']);
          const hotfixDateRaw = getImportCell(row, headerIndex, ['ngaydayhotfix', 'hotfixdate']);
          const notiDateRaw = getImportCell(row, headerIndex, ['ngaythongbaokh', 'notidate', 'notificationdate']);
          const taskLink = getImportCell(row, headerIndex, ['tasklink', 'linkjira', 'link']);
          const changeLog = getImportCell(row, headerIndex, ['huongxuly', 'changelog']);
          const testNote = getImportCell(row, headerIndex, ['ghichukiemthu', 'testnote']);
          const notes = getImportCell(row, headerIndex, ['ghichu', 'notes']);

          if (!ticketCode && !summary && !customerRaw && !serviceGroupRaw && !assigneeRaw && !projectRaw && !productRaw && !reporterName && !priorityRaw && !statusRaw && !requestedDateRaw && !dueDateRaw && !resolvedDateRaw && !hotfixDateRaw && !notiDateRaw && !taskLink && !changeLog && !testNote && !notes) {
            continue;
          }

          if (!summary || !customerRaw) {
            failures.push(`Dòng ${rowNumber}: thiếu Nội dung yêu cầu hoặc Đơn vị yêu cầu.`);
            continue;
          }

          const customer = customerByToken.get(normalizeImportToken(customerRaw));
          if (!customer) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy khách hàng "${customerRaw}".`);
            continue;
          }

          const project = projectRaw ? projectByToken.get(normalizeImportToken(projectRaw)) : undefined;
          if (projectRaw && !project) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy dự án "${projectRaw}".`);
            continue;
          }

          const product = productRaw ? productByToken.get(normalizeImportToken(productRaw)) : undefined;
          if (productRaw && !product) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy sản phẩm "${productRaw}".`);
            continue;
          }

          const serviceGroup = serviceGroupRaw ? groupByToken.get(normalizeImportToken(serviceGroupRaw)) : undefined;
          if (serviceGroupRaw && !serviceGroup) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy nhóm hỗ trợ "${serviceGroupRaw}".`);
            continue;
          }

          const assignee = assigneeRaw ? employeeByToken.get(normalizeImportToken(assigneeRaw)) : undefined;
          if (assigneeRaw && !assignee) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy người xử lý "${assigneeRaw}".`);
            continue;
          }

          const requestedDate = normalizeImportDate(requestedDateRaw) || new Date().toISOString().slice(0, 10);
          const dueDate = dueDateRaw ? normalizeImportDate(dueDateRaw) : null;
          const resolvedDate = resolvedDateRaw ? normalizeImportDate(resolvedDateRaw) : null;
          const hotfixDate = hotfixDateRaw ? normalizeImportDate(hotfixDateRaw) : null;
          const notiDate = notiDateRaw ? normalizeImportDate(notiDateRaw) : null;

          if ((dueDateRaw && !dueDate) || (resolvedDateRaw && !resolvedDate) || (hotfixDateRaw && !hotfixDate) || (notiDateRaw && !notiDate)) {
            failures.push(`Dòng ${rowNumber}: có ngày tháng không hợp lệ.`);
            continue;
          }

          try {
            const created = await createSupportRequest({
              ticket_code: ticketCode || null,
              summary,
              customer_id: customer.id,
              service_group_id: serviceGroup?.id || null,
              assignee_id: assignee?.id || null,
              project_id: project?.id || null,
              product_id: product?.id || null,
              reporter_name: reporterName || null,
              priority: normalizeSupportPriorityImport(priorityRaw),
              status: normalizeSupportStatusImport(statusRaw),
              requested_date: requestedDate,
              due_date: dueDate,
              resolved_date: resolvedDate,
              hotfix_date: hotfixDate,
              noti_date: notiDate,
              task_link: taskLink || null,
              change_log: changeLog || null,
              test_note: testNote || null,
              notes: notes || null,
            });
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (createdItems.length > 0) {
          setSupportRequests((prev) => [...createdItems, ...(prev || [])]);
          await refreshSupportRequestHistories();
        }

        summarizeImportResult('Yêu cầu hỗ trợ', createdItems.length, failures);
        if (createdItems.length > 0) {
          handleCloseModal();
          return;
        }
      } else {
        addToast('error', 'Nhập dữ liệu', 'Module này chưa hỗ trợ import.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Nhập dữ liệu thất bại', message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Modal Handlers
  const handleOpenModal = (type: ModalType, item?: any) => {
    setModalType(type);
    // Reset selections
    setSelectedDept(null);
    setSelectedEmployee(null);
    setSelectedBusiness(null);
    setSelectedVendor(null);
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setSelectedCusPersonnel(null);
    setSelectedOpportunity(null);
    setSelectedProject(null);
    setSelectedContract(null);
    setSelectedDocument(null);
    setSelectedReminder(null);

    if (type === 'ADD_USER_DEPT_HISTORY' && item && 'username' in item) {
      const employee = item as Employee;
      setSelectedEmployee(employee);
      setSelectedUserDeptHistory({
        id: '',
        userId: String(employee.id ?? ''),
        fromDeptId: String(employee.department_id ?? ''),
        toDeptId: '',
        transferDate: new Date().toISOString().split('T')[0],
        reason: '',
      });
      return;
    }

    if (type?.includes('EMPLOYEE')) {
       setSelectedEmployee(item as Employee);
    } else if (type?.includes('BUSINESS')) {
       setSelectedBusiness(item as Business);
    } else if (type?.includes('VENDOR')) {
       setSelectedVendor(item as Vendor);
    } else if (type?.includes('PRODUCT')) {
       setSelectedProduct(item as Product);
    } else if (type?.includes('CUSTOMER')) {
       setSelectedCustomer(item as Customer);
    } else if (type?.includes('CUS_PERSONNEL')) {
       setSelectedCusPersonnel(item as CustomerPersonnel);
    } else if (type?.includes('OPPORTUNITY')) {
       setSelectedOpportunity(item as Opportunity);
    } else if (type?.includes('PROJECT')) {
       setSelectedProject(item as Project);
    } else if (type?.includes('CONTRACT')) {
       setSelectedContract(item as Contract);
    } else if (type?.includes('DOCUMENT')) {
       setSelectedDocument(item as Document);
    } else if (type?.includes('REMINDER')) {
       setSelectedReminder(item as Reminder);
    } else if (type?.includes('USER_DEPT_HISTORY')) {
       setSelectedUserDeptHistory((item as UserDeptHistory) || null);
    } else if (item && 'dept_code' in item) {
       setSelectedDept(item as Department);
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedDept(null);
    setSelectedEmployee(null);
    setSelectedBusiness(null);
    setSelectedVendor(null);
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setSelectedCusPersonnel(null);
    setSelectedOpportunity(null);
    setSelectedProject(null);
    setSelectedContract(null);
    setSelectedDocument(null);
    setSelectedReminder(null);
    setSelectedUserDeptHistory(null);
    setIsSaving(false);
  };

  // --- Department Handlers ---
  const handleSaveDepartment = async (data: Partial<Department>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_DEPARTMENT') {
        const created = await createDepartment(data);
        setDepartments([created, ...departments]);
        addToast('success', 'Thành công', 'Thêm mới phòng ban thành công!');
      } else if (modalType === 'EDIT_DEPARTMENT' && selectedDept) {
        const updated = await updateDepartment(selectedDept.id, data);
        setDepartments(
          departments.map(d =>
            String(d.id) === String(updated.id)
              ? updated
              : d
          )
        );
        addToast('success', 'Thành công', 'Cập nhật phòng ban thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu phòng ban vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDept) return;
    try {
      await deleteDepartment(selectedDept.id);
      setDepartments((departments || []).filter(d => String(d.id) !== String(selectedDept.id)));
      addToast('success', 'Thành công', 'Đã xóa phòng ban khỏi hệ thống.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa phòng ban trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Employee Handlers ---
  const handleSaveEmployee = async (data: Partial<Employee>) => {
      setIsSaving(true);
      try {
        if (modalType === 'ADD_EMPLOYEE') {
          const created = await createEmployee(data);
          setEmployees([created, ...employees]);
          addToast('success', 'Thành công', 'Thêm mới nhân sự thành công!');
        } else if (modalType === 'EDIT_EMPLOYEE' && selectedEmployee) {
          const updated = await updateEmployee(selectedEmployee.id, data);
          setEmployees(
            (employees || []).map(e =>
              String(e.id) === String(updated.id)
                ? updated
                : e
            )
          );
          addToast('success', 'Thành công', 'Cập nhật thông tin nhân sự thành công!');
        }
        handleCloseModal();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lỗi không xác định';
        addToast('error', 'Lưu thất bại', `Không thể lưu nhân sự vào cơ sở dữ liệu. ${message}`);
        setIsSaving(false);
      }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    try {
      await deleteEmployee(selectedEmployee.id);
      setEmployees((employees || []).filter(e => String(e.id) !== String(selectedEmployee.id)));
      addToast('success', 'Thành công', 'Đã xóa nhân sự thành công.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa nhân sự trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Business Handlers ---
  const handleSaveBusiness = async (data: Partial<Business>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const businessData: Business = {
       id: data.domain_code!,
       domain_code: data.domain_code!,
       domain_name: data.domain_name!,
       created_at: data.created_at || new Date().toISOString().split('T')[0]
    };

    if (modalType === 'ADD_BUSINESS') {
      setBusinesses([businessData, ...businesses]);
      addToast('success', 'Thành công', 'Thêm mới lĩnh vực kinh doanh thành công!');
    } else if (modalType === 'EDIT_BUSINESS') {
      setBusinesses(businesses.map(b => b.id === businessData.id ? businessData : b));
      addToast('success', 'Thành công', 'Cập nhật lĩnh vực thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setBusinesses((businesses || []).filter(b => b.id !== selectedBusiness.id));
    addToast('success', 'Thành công', 'Đã xóa lĩnh vực kinh doanh.');
    handleCloseModal();
  };

  // --- Vendor Handlers ---
  const handleSaveVendor = async (data: Partial<Vendor>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_VENDOR') {
        const created = await createVendor(data);
        setVendors([created, ...vendors]);
        addToast('success', 'Thành công', 'Thêm mới đối tác thành công!');
      } else if (modalType === 'EDIT_VENDOR' && selectedVendor) {
        const updated = await updateVendor(selectedVendor.id, data);
        setVendors(
          (vendors || []).map(v =>
            String(v.id) === String(updated.id)
              ? updated
              : v
          )
        );
        addToast('success', 'Thành công', 'Cập nhật đối tác thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu đối tác vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!selectedVendor) return;
    try {
      await deleteVendor(selectedVendor.id);
      setVendors((vendors || []).filter(v => String(v.id) !== String(selectedVendor.id)));
      addToast('success', 'Thành công', 'Đã xóa đối tác.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa đối tác trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Product Handlers ---
  const handleSaveProduct = async (data: Partial<Product>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const productData: Product = {
      id: data.product_code!,
      product_code: data.product_code!,
      product_name: data.product_name!,
      domain_id: data.domain_id!,
      vendor_id: data.vendor_id!,
      standard_price: data.standard_price || 0,
      unit: data.unit || 'Cái/Gói',
      created_at: data.created_at || new Date().toISOString().split('T')[0]
    };

    if (modalType === 'ADD_PRODUCT') {
      setProducts([productData, ...products]);
      addToast('success', 'Thành công', 'Thêm mới sản phẩm thành công!');
    } else if (modalType === 'EDIT_PRODUCT') {
      setProducts(products.map(p => p.id === productData.id ? productData : p));
      addToast('success', 'Thành công', 'Cập nhật sản phẩm thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProducts((products || []).filter(p => p.id !== selectedProduct.id));
    addToast('success', 'Thành công', 'Đã xóa sản phẩm.');
    handleCloseModal();
  };

  // --- Customer Handlers ---
  const handleSaveCustomer = async (data: Partial<Customer>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_CUSTOMER') {
        const created = await createCustomer(data);
        setCustomers([created, ...customers]);
        addToast('success', 'Thành công', 'Thêm mới khách hàng thành công!');
      } else if (modalType === 'EDIT_CUSTOMER' && selectedCustomer) {
        const updated = await updateCustomer(selectedCustomer.id, data);
        setCustomers(
          (customers || []).map(c =>
            String(c.id) === String(updated.id)
              ? updated
              : c
          )
        );
        addToast('success', 'Thành công', 'Cập nhật khách hàng thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu khách hàng vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    try {
      await deleteCustomer(selectedCustomer.id);
      setCustomers((customers || []).filter(c => String(c.id) !== String(selectedCustomer.id)));
      addToast('success', 'Thành công', 'Đã xóa khách hàng.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa khách hàng trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Customer Personnel Handlers ---
  const handleSaveCusPersonnel = async (data: Partial<CustomerPersonnel>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newItem: CustomerPersonnel = {
      id: data.id || `CP${Date.now()}`, 
      fullName: data.fullName!,
      birthday: data.birthday!,
      positionType: data.positionType!,
      phoneNumber: data.phoneNumber!,
      email: data.email!,
      customerId: data.customerId!,
      status: data.status || 'Active',
    };

    if (modalType === 'ADD_CUS_PERSONNEL') {
      setCusPersonnel([newItem, ...cusPersonnel]);
      addToast('success', 'Thành công', 'Thêm mới nhân sự liên hệ thành công!');
    } else if (modalType === 'EDIT_CUS_PERSONNEL') {
      setCusPersonnel(cusPersonnel.map(p => p.id === selectedCusPersonnel?.id ? { ...newItem, id: selectedCusPersonnel.id } : p));
      addToast('success', 'Thành công', 'Cập nhật nhân sự liên hệ thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteCusPersonnel = async () => {
    if (!selectedCusPersonnel) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setCusPersonnel((cusPersonnel || []).filter(p => p.id !== selectedCusPersonnel.id));
    addToast('success', 'Thành công', 'Đã xóa nhân sự liên hệ.');
    handleCloseModal();
  };

  // --- Opportunity Handlers ---
  const handleSaveOpportunity = async (data: Partial<Opportunity>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_OPPORTUNITY') {
        const created = await createOpportunity(data);
        setOpportunities([created, ...opportunities]);
        addToast('success', 'Thành công', 'Thêm mới cơ hội thành công!');
      } else if (modalType === 'EDIT_OPPORTUNITY' && selectedOpportunity) {
        const updated = await updateOpportunity(selectedOpportunity.id, data);
        setOpportunities(
          (opportunities || []).map(o =>
            String(o.id) === String(updated.id)
              ? updated
              : o
          )
        );
        addToast('success', 'Thành công', 'Cập nhật cơ hội thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu cơ hội vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteOpportunity = async () => {
    if (!selectedOpportunity) return;
    try {
      await deleteOpportunity(selectedOpportunity.id);
      setOpportunities((opportunities || []).filter(o => String(o.id) !== String(selectedOpportunity.id)));
      addToast('success', 'Thành công', 'Đã xóa cơ hội kinh doanh.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa cơ hội trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Project Handlers ---
  const handleSaveProject = async (data: Partial<Project>) => {
    setIsSaving(true);
    try {
      const payload = data as Partial<Project> & Record<string, unknown>;
      if (modalType === 'ADD_PROJECT') {
        const created = await createProject(payload);
        setProjects([created, ...projects]);
        setActiveTab('projects');
        addToast('success', 'Thành công', 'Thêm mới dự án thành công!');
      } else if (modalType === 'EDIT_PROJECT' && selectedProject) {
        const updated = await updateProject(selectedProject.id, payload);
        setProjects(
          (projects || []).map(p =>
            String(p.id) === String(updated.id)
              ? updated
              : p
          )
        );
        addToast('success', 'Thành công', 'Cập nhật dự án thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu dự án vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    try {
      await deleteProject(selectedProject.id);
      setProjects((projects || []).filter(p => String(p.id) !== String(selectedProject.id)));
      addToast('success', 'Thành công', 'Đã xóa dự án.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa dự án trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Contract Handlers ---
  const replaceSchedulesByContract = (contractId: string | number, schedules: PaymentSchedule[]) => {
    setPaymentSchedules((prev) => [
      ...(prev || []).filter((item) => String(item.contract_id) !== String(contractId)),
      ...(schedules || []),
    ]);
  };

  const handleRefreshSchedules = async (contractId: string | number) => {
    setIsPaymentScheduleLoading(true);
    try {
      const rows = await fetchPaymentSchedules(contractId);
      replaceSchedulesByContract(contractId, rows);
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  };

  const handleGenerateSchedules = async (contractId: string | number, options?: { silent?: boolean }) => {
    setIsPaymentScheduleLoading(true);
    try {
      const generated = await generateContractPayments(contractId);
      replaceSchedulesByContract(contractId, generated);
      if (!options?.silent) {
        addToast('success', 'Thành công', `Đã đồng bộ ${generated.length} kỳ thanh toán.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Sinh dòng tiền thất bại', `Không thể sinh kỳ thanh toán tự động. ${message}`);
      }
      throw error;
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  };

  const handleConfirmPaymentSchedule = async (
    scheduleId: string | number,
    payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
  ) => {
    try {
      const updated = await updatePaymentSchedule(scheduleId, payload);
      setPaymentSchedules((prev) =>
        (prev || []).map((item) =>
          String(item.id) === String(updated.id)
            ? updated
            : item
        )
      );
      addToast('success', 'Thành công', 'Đã xác nhận thu tiền cho kỳ thanh toán.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật thất bại', `Không thể xác nhận thu tiền. ${message}`);
      throw error;
    }
  };

  const handleSaveContract = async (data: Partial<Contract>) => {
    setIsSaving(true);
    try {
      const payload = data as Partial<Contract> & Record<string, unknown>;
      if (modalType === 'ADD_CONTRACT') {
        const created = await createContract(payload);
        setContracts([created, ...contracts]);
        if (created.status === 'SIGNED') {
          try {
            await handleGenerateSchedules(created.id, { silent: true });
            addToast('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            addToast('error', 'Dòng tiền', `Hợp đồng đã lưu nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }
        addToast('success', 'Thành công', 'Thêm mới hợp đồng thành công!');
      } else if (modalType === 'EDIT_CONTRACT' && selectedContract) {
        const previousStatus = selectedContract.status;
        const updated = await updateContract(selectedContract.id, payload);
        setContracts(
          (contracts || []).map(c =>
            String(c.id) === String(updated.id)
              ? updated
              : c
          )
        );
        if (updated.status === 'SIGNED' && previousStatus !== 'SIGNED') {
          try {
            await handleGenerateSchedules(updated.id, { silent: true });
            addToast('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            addToast('error', 'Dòng tiền', `Hợp đồng đã cập nhật nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }
        addToast('success', 'Thành công', 'Cập nhật hợp đồng thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu hợp đồng vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!selectedContract) return;
    try {
      await deleteContract(selectedContract.id);
      setContracts((contracts || []).filter(c => String(c.id) !== String(selectedContract.id)));
      addToast('success', 'Thành công', 'Đã xóa hợp đồng.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa hợp đồng trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Document Handlers ---
  const handleSaveDocument = async (data: Partial<Document>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newItem: Document = {
        id: data.id!,
        name: data.name!,
        typeId: data.typeId!,
        customerId: data.customerId!,
        projectId: data.projectId,
        expiryDate: data.expiryDate,
        status: data.status || 'ACTIVE',
        attachments: data.attachments || [],
        createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_DOCUMENT') {
        setDocuments([newItem, ...documents]);
        addToast('success', 'Thành công', 'Thêm mới hồ sơ tài liệu thành công!');
    } else if (modalType === 'EDIT_DOCUMENT') {
        setDocuments(documents.map(d => d.id === selectedDocument?.id ? { ...newItem, id: selectedDocument.id } : d));
        addToast('success', 'Thành công', 'Cập nhật hồ sơ tài liệu thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setDocuments((documents || []).filter(d => d.id !== selectedDocument.id));
    addToast('success', 'Thành công', 'Đã xóa hồ sơ tài liệu.');
    handleCloseModal();
  };

  // --- Reminder Handlers ---
  const handleSaveReminder = async (data: Partial<Reminder>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newItem: Reminder = {
        id: data.id || `REM${Date.now()}`,
        title: data.title!,
        content: data.content || '',
        remindDate: data.remindDate!,
        assignedToUserId: data.assignedToUserId!,
        createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_REMINDER') {
        setReminders([newItem, ...reminders]);
        addToast('success', 'Thành công', 'Thêm mới nhắc việc thành công!');
    } else if (modalType === 'EDIT_REMINDER') {
        setReminders(reminders.map(r => r.id === selectedReminder?.id ? { ...newItem, id: selectedReminder.id } : r));
        addToast('success', 'Thành công', 'Cập nhật nhắc việc thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteReminder = async () => {
    if (!selectedReminder) return;
    await new Promise(resolve => setTimeout(resolve, 800));
    setReminders((reminders || []).filter(r => r.id !== selectedReminder.id));
    addToast('success', 'Thành công', 'Đã xóa nhắc việc.');
    handleCloseModal();
  };

  // --- User Dept History Handlers ---
  const handleSaveUserDeptHistory = async (data: Partial<UserDeptHistory>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const nextTransferNumericId = (() => {
      const currentMax = (userDeptHistory || []).reduce((max, item) => {
        const parsed = Number(String(item.id ?? '').replace(/\D+/g, ''));
        return Number.isFinite(parsed) && parsed > max ? parsed : max;
      }, 0);
      return String(currentMax + 1);
    })();

    const newItem: UserDeptHistory = {
        id: modalType === 'ADD_USER_DEPT_HISTORY'
          ? nextTransferNumericId
          : String(data.id || selectedUserDeptHistory?.id || ''),
        userId: String(data.userId || ''),
        fromDeptId: String(data.fromDeptId || ''),
        toDeptId: String(data.toDeptId || ''),
        transferDate: data.transferDate!,
        reason: data.reason || '',
        createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_USER_DEPT_HISTORY') {
        setUserDeptHistory([newItem, ...userDeptHistory]);
        
        // --- LOGIC NGHIỆP VỤ QUAN TRỌNG ---
        // Cập nhật phòng ban mới cho nhân sự
        setEmployees(prev => prev.map(emp => {
            if (String(emp.id) === String(newItem.userId)) {
                const targetDept = departments.find(d => d.dept_name === newItem.toDeptId || String(d.id) === String(newItem.toDeptId));
                return { ...emp, department_id: targetDept?.id || emp.department_id };
            }
            return emp;
        }));
        
        addToast('success', 'Thành công', 'Thêm mới luân chuyển và cập nhật nhân sự thành công!');
    } else if (modalType === 'EDIT_USER_DEPT_HISTORY') {
        setUserDeptHistory(userDeptHistory.map(h => h.id === selectedUserDeptHistory?.id ? { ...newItem, id: selectedUserDeptHistory.id } : h));
        addToast('success', 'Thành công', 'Cập nhật lịch sử luân chuyển thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteUserDeptHistory = async () => {
    if (!selectedUserDeptHistory) return;
    await new Promise(resolve => setTimeout(resolve, 800));
    setUserDeptHistory((userDeptHistory || []).filter(h => h.id !== selectedUserDeptHistory.id));
    addToast('success', 'Thành công', 'Đã xóa lịch sử luân chuyển.');
    handleCloseModal();
  };

  const refreshSupportRequestHistories = async () => {
    try {
      const rows = await fetchSupportRequestHistories();
      setSupportRequestHistories(rows);
    } catch {
      // Ignore refresh error, toast handled by caller.
    }
  };

  const handleCreateSupportServiceGroup = async (data: Partial<SupportServiceGroup>): Promise<SupportServiceGroup> => {
    try {
      const created = await createSupportServiceGroup(data);
      setSupportServiceGroups((prev) => [created, ...(prev || [])]);
      addToast('success', 'Thành công', 'Đã tạo nhóm hỗ trợ.');
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tạo nhóm thất bại', `Không thể tạo nhóm hỗ trợ. ${message}`);
      throw error;
    }
  };

  const handleCreateSupportRequest = async (data: Partial<SupportRequest>) => {
    try {
      const created = await createSupportRequest(data);
      setSupportRequests((prev) => [created, ...(prev || [])]);
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã thêm yêu cầu hỗ trợ.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể thêm yêu cầu hỗ trợ. ${message}`);
      throw error;
    }
  };

  const handleUpdateSupportRequest = async (id: string | number, data: Partial<SupportRequest>) => {
    try {
      const updated = await updateSupportRequest(id, data);
      setSupportRequests((prev) =>
        (prev || []).map((item) =>
          String(item.id) === String(updated.id)
            ? updated
            : item
        )
      );
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã cập nhật yêu cầu hỗ trợ.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật thất bại', `Không thể cập nhật yêu cầu hỗ trợ. ${message}`);
      throw error;
    }
  };

  const handleDeleteSupportRequest = async (id: string | number) => {
    try {
      await deleteSupportRequest(id);
      setSupportRequests((prev) => (prev || []).filter((item) => String(item.id) !== String(id)));
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã xóa yêu cầu hỗ trợ.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa yêu cầu hỗ trợ. ${message}`);
      throw error;
    }
  };

  const handleUpdateSupportRequestStatus = async (
    id: string | number,
    status: SupportRequestStatus,
    comment?: string | null
  ) => {
    try {
      const updated = await updateSupportRequestStatus(id, {
        new_status: status,
        comment: comment || null,
      });
      setSupportRequests((prev) =>
        (prev || []).map((item) =>
          String(item.id) === String(updated.id)
            ? updated
            : item
        )
      );
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã cập nhật trạng thái yêu cầu.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật thất bại', `Không thể cập nhật trạng thái. ${message}`);
      throw error;
    }
  };

  const handleLoadSupportRequestHistory = async (id: string | number): Promise<SupportRequestHistory[]> => {
    try {
      return await fetchSupportRequestHistory(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải lịch sử thất bại', `Không thể tải lịch sử trạng thái. ${message}`);
      throw error;
    }
  };

  // --- Dashboard Stats ---
  const OPPORTUNITY_STAGE_ORDER: OpportunityStage[] = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
  const PROJECT_STATUS_ORDER: ProjectStatus[] = ['PLANNING', 'ONGOING', 'COMPLETED', 'CANCELLED'];

  const totalRevenue = (contracts || [])
    .filter((contract) => contract.status === 'SIGNED')
    .reduce((sum, contract) => sum + (contract.value || 0), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
  const quarterEndMonth = quarterStartMonth + 2;

  const actualRevenue = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PAID')
    .reduce((sum, schedule) => sum + Number(schedule.actual_paid_amount || 0), 0);

  const forecastRevenueMonth = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PENDING')
    .filter((schedule) => {
      const expected = new Date(schedule.expected_date);
      return expected.getFullYear() === currentYear && expected.getMonth() === currentMonth;
    })
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

  const forecastRevenueQuarter = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PENDING')
    .filter((schedule) => {
      const expected = new Date(schedule.expected_date);
      return (
        expected.getFullYear() === currentYear &&
        expected.getMonth() >= quarterStartMonth &&
        expected.getMonth() <= quarterEndMonth
      );
    })
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

  const monthlyRevenueComparison = (() => {
    const monthLabels: Array<{ month: string; year: number; monthIndex: number }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const point = new Date(currentYear, currentMonth - i, 1);
      monthLabels.push({
        month: point.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
        year: point.getFullYear(),
        monthIndex: point.getMonth(),
      });
    }

    return monthLabels.map((point) => {
      const planned = (paymentSchedules || [])
        .filter((schedule) => {
          const expected = new Date(schedule.expected_date);
          return expected.getFullYear() === point.year && expected.getMonth() === point.monthIndex;
        })
        .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

      const actual = (paymentSchedules || [])
        .filter((schedule) => schedule.status === 'PAID')
        .filter((schedule) => {
          const paidDate = schedule.actual_paid_date ? new Date(schedule.actual_paid_date) : null;
          return paidDate !== null && paidDate.getFullYear() === point.year && paidDate.getMonth() === point.monthIndex;
        })
        .reduce((sum, schedule) => sum + Number(schedule.actual_paid_amount || 0), 0);

      return {
        month: point.month,
        planned,
        actual,
      };
    });
  })();

  const pipelineByStage = OPPORTUNITY_STAGE_ORDER.map((stage) => ({
    stage,
    value: (opportunities || [])
      .filter((opp) => opp.stage === stage)
      .reduce((sum, opp) => sum + (opp.amount || 0), 0),
  }));

  const projectStatusCounts = PROJECT_STATUS_ORDER.map((status) => ({
    status,
    count: (projects || []).filter((project) => project.status === status).length,
  }));

  const dashboardStats: DashboardStats = {
    totalRevenue,
    actualRevenue,
    forecastRevenueMonth,
    forecastRevenueQuarter,
    monthlyRevenueComparison,
    pipelineByStage,
    projectStatusCounts,
  };

  const hrStatistics: HRStatistics = useMemo(
    () => buildHrStatistics(employees, departments),
    [employees, departments]
  );

  const activeInternalUserSubTab: InternalUserSubTab =
    activeTab === 'internal_user_list' ? 'list' : internalUserSubTab;

  const activeModuleKey =
    activeTab === 'internal_user_dashboard'
      ? activeInternalUserSubTab === 'list'
        ? 'internal_user_list'
        : 'internal_user_dashboard'
      : activeTab;

  const handleConvertOpportunity = (opp: Opportunity) => {
    const initialProjectData: Partial<Project> = {
        project_name: `Dự án: ${opp.opp_name}`,
        customer_id: opp.customer_id,
        status: 'PLANNING',
    };
    
    // We treat this as "ADD" mode but pre-fill data
    setSelectedProject(initialProjectData as Project);
    setModalType('ADD_PROJECT');
  };

  return (
    <div className="flex h-screen bg-bg-light overflow-hidden flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-30">
         <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 p-1">
                 <span className="material-symbols-outlined">menu</span>
             </button>
             <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-primary">
                 <span className="material-symbols-outlined text-lg">business</span>
             </div>
             <h1 className="text-sm font-bold text-slate-900">VNPT Business</h1>
         </div>
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 overflow-y-auto bg-bg-light w-full">
        {activeTab === 'dashboard' && (
          <Dashboard stats={dashboardStats} />
        )}

        {(activeTab === 'internal_user_dashboard' || activeTab === 'internal_user_list') && (
          <InternalUserModuleTabs
            employees={employees}
            departments={departments}
            hrStatistics={hrStatistics}
            onOpenModal={handleOpenModal}
            activeSubTab={activeInternalUserSubTab}
            onSubTabChange={setInternalUserSubTab}
          />
        )}

        {activeTab === 'departments' && (
          <DepartmentList departments={departments} employees={employees} onOpenModal={handleOpenModal} />
        )}

        {activeTab === 'user_dept_history' && (
          <UserDeptHistoryList 
            history={userDeptHistory}
            employees={employees}
            departments={departments}
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'businesses' && (
          <BusinessList businesses={businesses} onOpenModal={handleOpenModal} />
        )}

        {activeTab === 'vendors' && (
          <VendorList vendors={vendors} onOpenModal={handleOpenModal} />
        )}

        {activeTab === 'products' && (
          <ProductList 
            products={products} 
            businesses={businesses} 
            vendors={vendors} 
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'clients' && (
          <CustomerList 
            customers={customers} 
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'cus_personnel' && (
          <CusPersonnelList 
            personnel={cusPersonnel}
            customers={customers}
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'opportunities' && (
          <OpportunityList 
             opportunities={opportunities}
             customers={customers}
             personnel={cusPersonnel}
             products={products}
             employees={employees}
             onOpenModal={handleOpenModal}
             onConvert={handleConvertOpportunity}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectList 
             projects={projects}
             customers={customers}
             onOpenModal={handleOpenModal}
          />
        )}

        {activeTab === 'contracts' && (
          <ContractList 
             contracts={contracts}
             projects={projects}
             customers={customers}
             onOpenModal={handleOpenModal}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentList 
             documents={documents}
             customers={customers}
             onOpenModal={handleOpenModal}
          />
        )}

        {activeTab === 'reminders' && (
          <ReminderList 
             reminders={reminders}
             employees={employees}
             onOpenModal={handleOpenModal}
          />
        )}

        {activeTab === 'support_requests' && (
          <SupportRequestList
            supportRequests={supportRequests}
            supportServiceGroups={supportServiceGroups}
            supportRequestHistories={supportRequestHistories}
            projectItems={projectItems}
            customers={customers}
            projects={projects}
            products={products}
            employees={employees}
            onCreateSupportServiceGroup={handleCreateSupportServiceGroup}
            onCreateSupportRequest={handleCreateSupportRequest}
            onUpdateSupportRequest={handleUpdateSupportRequest}
            onDeleteSupportRequest={handleDeleteSupportRequest}
            onLoadSupportRequestHistory={handleLoadSupportRequestHistory}
            onOpenImportModal={() => handleOpenModal('IMPORT_DATA')}
          />
        )}

        {activeTab === 'audit_logs' && (
          <AuditLogList
            auditLogs={auditLogs}
            employees={employees}
          />
        )}

        {/* Placeholder for other tabs */}
        {['dashboard', 'internal_user_dashboard', 'internal_user_list', 'departments', 'businesses', 'vendors', 'products', 'clients', 'cus_personnel', 'opportunities', 'projects', 'contracts', 'documents', 'reminders', 'support_requests', 'user_dept_history', 'audit_logs'].indexOf(activeTab) === -1 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
              <span className="material-symbols-outlined text-6xl mb-4">construction</span>
              <p className="text-lg font-medium">Chức năng đang phát triển...</p>
            </div>
        )}
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Modals */}
      {(modalType === 'ADD_DEPARTMENT' || modalType === 'EDIT_DEPARTMENT') && (
        <DepartmentFormModal 
          type={modalType === 'ADD_DEPARTMENT' ? 'ADD' : 'EDIT'}
          data={selectedDept}
          departments={departments}
          onClose={handleCloseModal}
          onSave={handleSaveDepartment}
          isLoading={isSaving}
        />
      )}

      {modalType === 'VIEW_DEPARTMENT' && selectedDept && (
        <ViewDepartmentModal 
          data={selectedDept}
          onClose={handleCloseModal}
          onEdit={() => handleOpenModal('EDIT_DEPARTMENT', selectedDept)}
        />
      )}

      {modalType === 'DELETE_DEPARTMENT' && selectedDept && (
        <DeleteWarningModal 
          data={selectedDept}
          onClose={handleCloseModal}
          onConfirm={handleDeleteDepartment}
        />
      )}

      {modalType === 'CANNOT_DELETE' && selectedDept && (
        <CannotDeleteModal 
          data={selectedDept}
          onClose={handleCloseModal}
        />
      )}

        {modalType === 'IMPORT_DATA' && (
        <ImportModal 
           title={
             activeModuleKey === 'departments' ? "Nhập dữ liệu phòng ban" : 
             activeModuleKey === 'internal_user_list' ? "Nhập dữ liệu nhân sự" :
             activeModuleKey === 'businesses' ? "Nhập dữ liệu lĩnh vực" :
             activeModuleKey === 'vendors' ? "Nhập dữ liệu đối tác" :
             activeModuleKey === 'products' ? "Nhập dữ liệu sản phẩm" :
             activeModuleKey === 'clients' ? "Nhập dữ liệu khách hàng" :
             activeModuleKey === 'support_requests' ? "Nhập dữ liệu yêu cầu hỗ trợ" :
             activeModuleKey === 'opportunities' ? "Nhập dữ liệu cơ hội" :
             activeModuleKey === 'projects' ? "Nhập dữ liệu dự án" :
             "Nhập dữ liệu nhân sự liên hệ"
           }
           moduleKey={activeModuleKey}
           onClose={handleCloseModal}
           onSave={handleImportData}
           isLoading={isSaving}
        />
      )}

      {(modalType === 'ADD_EMPLOYEE' || modalType === 'EDIT_EMPLOYEE') && (
        <EmployeeFormModal 
          type={modalType === 'ADD_EMPLOYEE' ? 'ADD' : 'EDIT'}
          data={selectedEmployee}
          departments={departments}
          onClose={handleCloseModal} 
          onSave={handleSaveEmployee} 
        />
      )}

      {modalType === 'DELETE_EMPLOYEE' && selectedEmployee && (
        <DeleteEmployeeModal 
          data={selectedEmployee}
          onClose={handleCloseModal}
          onConfirm={handleDeleteEmployee}
        />
      )}

      {(modalType === 'ADD_BUSINESS' || modalType === 'EDIT_BUSINESS') && (
        <BusinessFormModal 
          type={modalType === 'ADD_BUSINESS' ? 'ADD' : 'EDIT'}
          data={selectedBusiness}
          onClose={handleCloseModal} 
          onSave={handleSaveBusiness} 
        />
      )}

      {modalType === 'DELETE_BUSINESS' && selectedBusiness && (
         <DeleteBusinessModal 
           data={selectedBusiness}
           onClose={handleCloseModal}
           onConfirm={handleDeleteBusiness}
         />
      )}

      {(modalType === 'ADD_VENDOR' || modalType === 'EDIT_VENDOR') && (
        <VendorFormModal 
          type={modalType === 'ADD_VENDOR' ? 'ADD' : 'EDIT'}
          data={selectedVendor}
          onClose={handleCloseModal} 
          onSave={handleSaveVendor} 
        />
      )}

      {modalType === 'DELETE_VENDOR' && selectedVendor && (
         <DeleteVendorModal 
           data={selectedVendor}
           onClose={handleCloseModal}
           onConfirm={handleDeleteVendor}
         />
      )}

      {(modalType === 'ADD_PRODUCT' || modalType === 'EDIT_PRODUCT') && (
        <ProductFormModal 
          type={modalType === 'ADD_PRODUCT' ? 'ADD' : 'EDIT'}
          data={selectedProduct}
          businesses={businesses}
          vendors={vendors}
          onClose={handleCloseModal}
          onSave={handleSaveProduct}
        />
      )}

      {modalType === 'DELETE_PRODUCT' && selectedProduct && (
        <DeleteProductModal 
          data={selectedProduct}
          onClose={handleCloseModal}
          onConfirm={handleDeleteProduct}
        />
      )}

      {(modalType === 'ADD_CUSTOMER' || modalType === 'EDIT_CUSTOMER') && (
        <CustomerFormModal 
          type={modalType === 'ADD_CUSTOMER' ? 'ADD' : 'EDIT'}
          data={selectedCustomer}
          onClose={handleCloseModal}
          onSave={handleSaveCustomer}
        />
      )}

      {modalType === 'DELETE_CUSTOMER' && selectedCustomer && (
        <DeleteCustomerModal 
          data={selectedCustomer}
          onClose={handleCloseModal}
          onConfirm={handleDeleteCustomer}
        />
      )}

      {(modalType === 'ADD_CUS_PERSONNEL' || modalType === 'EDIT_CUS_PERSONNEL') && (
        <CusPersonnelFormModal 
          type={modalType === 'ADD_CUS_PERSONNEL' ? 'ADD' : 'EDIT'}
          data={selectedCusPersonnel}
          customers={customers}
          onClose={handleCloseModal}
          onSave={handleSaveCusPersonnel}
        />
      )}

      {modalType === 'DELETE_CUS_PERSONNEL' && selectedCusPersonnel && (
        <DeleteCusPersonnelModal 
          data={selectedCusPersonnel}
          onClose={handleCloseModal}
          onConfirm={handleDeleteCusPersonnel}
        />
      )}

      {(modalType === 'ADD_OPPORTUNITY' || modalType === 'EDIT_OPPORTUNITY') && (
        <OpportunityFormModal 
          type={modalType === 'ADD_OPPORTUNITY' ? 'ADD' : 'EDIT'}
          data={selectedOpportunity}
          customers={customers}
          personnel={cusPersonnel}
          products={products}
          employees={employees}
          onClose={handleCloseModal}
          onSave={handleSaveOpportunity}
        />
      )}

      {modalType === 'DELETE_OPPORTUNITY' && selectedOpportunity && (
        <DeleteOpportunityModal 
          data={selectedOpportunity}
          onClose={handleCloseModal}
          onConfirm={handleDeleteOpportunity}
        />
      )}

      {(modalType === 'ADD_PROJECT' || modalType === 'EDIT_PROJECT') && (
        <ProjectFormModal 
          type={modalType === 'ADD_PROJECT' ? 'ADD' : 'EDIT'}
          data={selectedProject}
          customers={customers}
          opportunities={opportunities}
          products={products}
          employees={employees}
          departments={departments}
          onClose={handleCloseModal}
          onSave={handleSaveProject}
        />
      )}

      {modalType === 'DELETE_PROJECT' && selectedProject && (
        <DeleteProjectModal 
          data={selectedProject}
          onClose={handleCloseModal}
          onConfirm={handleDeleteProject}
        />
      )}

      {(modalType === 'ADD_CONTRACT' || modalType === 'EDIT_CONTRACT') && (
        <ContractModal
          type={modalType === 'ADD_CONTRACT' ? 'ADD' : 'EDIT'}
          data={selectedContract}
          projects={projects}
          customers={customers}
          paymentSchedules={paymentSchedules}
          isPaymentLoading={isPaymentScheduleLoading}
          onClose={handleCloseModal}
          onSave={handleSaveContract}
          onGenerateSchedules={handleGenerateSchedules}
          onRefreshSchedules={handleRefreshSchedules}
          onConfirmPayment={handleConfirmPaymentSchedule}
        />
      )}

      {modalType === 'DELETE_CONTRACT' && selectedContract && (
        <DeleteContractModal 
          data={selectedContract}
          onClose={handleCloseModal}
          onConfirm={handleDeleteContract}
        />
      )}

      {(modalType === 'ADD_DOCUMENT' || modalType === 'EDIT_DOCUMENT') && (
        <DocumentFormModal 
          type={modalType === 'ADD_DOCUMENT' ? 'ADD' : 'EDIT'}
          data={selectedDocument}
          customers={customers}
          projects={projects}
          onClose={handleCloseModal}
          onSave={handleSaveDocument}
        />
      )}

      {modalType === 'DELETE_DOCUMENT' && selectedDocument && (
        <DeleteDocumentModal 
          data={selectedDocument}
          onClose={handleCloseModal}
          onConfirm={handleDeleteDocument}
        />
      )}

      {(modalType === 'ADD_REMINDER' || modalType === 'EDIT_REMINDER') && (
        <ReminderFormModal 
          type={modalType === 'ADD_REMINDER' ? 'ADD' : 'EDIT'}
          data={selectedReminder}
          employees={employees}
          onClose={handleCloseModal}
          onSave={handleSaveReminder}
        />
      )}

      {modalType === 'DELETE_REMINDER' && selectedReminder && (
        <DeleteReminderModal 
          data={selectedReminder}
          onClose={handleCloseModal}
          onConfirm={handleDeleteReminder}
        />
      )}

      {(modalType === 'ADD_USER_DEPT_HISTORY' || modalType === 'EDIT_USER_DEPT_HISTORY') && (
        <UserDeptHistoryFormModal 
          type={modalType === 'ADD_USER_DEPT_HISTORY' ? 'ADD' : 'EDIT'}
          data={selectedUserDeptHistory}
          employees={employees}
          departments={departments}
          onClose={handleCloseModal}
          onSave={handleSaveUserDeptHistory}
        />
      )}

      {modalType === 'DELETE_USER_DEPT_HISTORY' && selectedUserDeptHistory && (
        <DeleteUserDeptHistoryModal 
          data={selectedUserDeptHistory}
          onClose={handleCloseModal}
          onConfirm={handleDeleteUserDeptHistory}
        />
      )}

    </div>
  );
};

export default App;
