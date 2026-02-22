import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DepartmentList } from './components/DepartmentList';
import { EmployeeList } from './components/EmployeeList';
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
import { Dashboard } from './components/Dashboard';
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
  ContractFormModal,
  DeleteContractModal,
  DocumentFormModal,
  DeleteDocumentModal,
  ReminderFormModal,
  DeleteReminderModal,
  UserDeptHistoryFormModal,
  DeleteUserDeptHistoryModal
} from './components/Modals';
import { MOCK_DEPARTMENTS, MOCK_EMPLOYEES, MOCK_BUSINESSES, MOCK_VENDORS, MOCK_PRODUCTS, MOCK_CUSTOMERS, MOCK_CUSTOMER_PERSONNEL, MOCK_OPPORTUNITIES, MOCK_PROJECTS, MOCK_CONTRACTS, MOCK_DOCUMENTS, MOCK_REMINDERS, MOCK_USER_DEPT_HISTORY } from './constants';
import { Department, Employee, Business, Vendor, Product, Customer, CustomerPersonnel, Opportunity, Project, Contract, Document, Reminder, UserDeptHistory, ModalType, Toast, DashboardStats, OpportunityStatus, OpportunityStage, ProjectStatus } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [departments, setDepartments] = useState<Department[]>(MOCK_DEPARTMENTS || []);
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES || []);
  const [businesses, setBusinesses] = useState<Business[]>(MOCK_BUSINESSES || []);
  const [vendors, setVendors] = useState<Vendor[]>(MOCK_VENDORS || []);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS || []);
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS || []);
  const [cusPersonnel, setCusPersonnel] = useState<CustomerPersonnel[]>(MOCK_CUSTOMER_PERSONNEL || []);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(MOCK_OPPORTUNITIES || []);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS || []);
  const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS || []);
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS || []);
  const [reminders, setReminders] = useState<Reminder[]>(MOCK_REMINDERS || []);
  const [userDeptHistory, setUserDeptHistory] = useState<UserDeptHistory[]>(MOCK_USER_DEPT_HISTORY || []);
  
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Helper to add toast
  const addToast = (type: 'success' | 'error', title: string, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => (prev || []).filter(t => t.id !== id));
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
       setSelectedUserDeptHistory(item as UserDeptHistory);
    } else if (item && 'parent' in item) { 
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
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (modalType === 'ADD_DEPARTMENT') {
       const newDept: Department = {
         dept_code: data.dept_code!,
         dept_name: data.dept_name!,
         parent_id: data.parent_id || null,
         status: data.status || 'ACTIVE',
         employeeCount: 0,
         createdDate: new Date().toLocaleDateString('vi-VN'),
         createdBy: 'Admin'
       };
       setDepartments([newDept, ...departments]);
       addToast('success', 'Thành công', 'Thêm mới phòng ban thành công!');
    } else if (modalType === 'EDIT_DEPARTMENT') {
       setDepartments(departments.map(d => d.dept_code === data.dept_code ? { ...d, ...data } as Department : d));
       addToast('success', 'Thành công', 'Cập nhật phòng ban thành công!');
    } else if (modalType === 'IMPORT_DATA') {
       addToast('success', 'Thành công', 'Nhập dữ liệu thành công!');
    }

    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDept) return;
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (selectedDept.status === 'INACTIVE') {
      setDepartments((departments || []).filter(d => d.dept_code !== selectedDept.dept_code));
      addToast('success', 'Thành công', 'Đã xóa phòng ban khỏi hệ thống.');
    } else {
      addToast('error', 'Xóa thất bại', `Không thể xóa phòng ban "${selectedDept.dept_name}" đang ở trạng thái Hoạt động.`);
    }
    handleCloseModal();
  };

  // --- Employee Handlers ---
  const handleSaveEmployee = async (data: Partial<Employee>) => {
      setIsSaving(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let formattedDob = data.dob || '';
      if (data.dob && data.dob.includes('-')) {
        const parts = data.dob.split('-');
        if (parts.length === 3) {
          formattedDob = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      const employeeData: Employee = {
          id: data.id!,
          name: data.name!,
          email: data.email!,
          dob: formattedDob || '01/01/1990',
          age: 25,
          gender: data.gender || 'Male',
          department: data.department || 'Phòng Nhân sự',
          type: data.type || 'Official',
          status: data.status || 'Active',
          phone: data.phone,
          position: data.position,
          ipAddress: data.ipAddress,
          vpnStatus: data.vpnStatus
      };

      if (modalType === 'ADD_EMPLOYEE') {
        setEmployees([employeeData, ...employees]);
        addToast('success', 'Thành công', 'Thêm mới nhân sự thành công!');
      } else if (modalType === 'EDIT_EMPLOYEE') {
        setEmployees(employees.map(e => e.id === employeeData.id ? employeeData : e));
        addToast('success', 'Thành công', 'Cập nhật thông tin nhân sự thành công!');
      }
      setIsSaving(false);
      handleCloseModal();
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setEmployees((employees || []).filter(e => e.id !== selectedEmployee.id));
    addToast('success', 'Thành công', 'Đã xóa nhân sự thành công.');
    handleCloseModal();
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    const vendorData: Vendor = {
       id: data.vendor_code!,
       vendor_code: data.vendor_code!,
       vendor_name: data.vendor_name!,
       created_at: data.created_at || new Date().toISOString().split('T')[0]
    };

    if (modalType === 'ADD_VENDOR') {
      setVendors([vendorData, ...vendors]);
      addToast('success', 'Thành công', 'Thêm mới đối tác thành công!');
    } else if (modalType === 'EDIT_VENDOR') {
      setVendors(vendors.map(v => v.id === vendorData.id ? vendorData : v));
      addToast('success', 'Thành công', 'Cập nhật đối tác thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteVendor = async () => {
    if (!selectedVendor) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setVendors((vendors || []).filter(v => v.id !== selectedVendor.id));
    addToast('success', 'Thành công', 'Đã xóa đối tác.');
    handleCloseModal();
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    const customerData: Customer = {
      id: data.customer_code!,
      customer_code: data.customer_code!,
      company_name: data.company_name!,
      tax_code: data.tax_code,
      address: data.address,
      created_at: data.created_at || new Date().toISOString().split('T')[0]
    };

    if (modalType === 'ADD_CUSTOMER') {
      setCustomers([customerData, ...customers]);
      addToast('success', 'Thành công', 'Thêm mới khách hàng thành công!');
    } else if (modalType === 'EDIT_CUSTOMER') {
      setCustomers(customers.map(c => c.id === customerData.id ? customerData : c));
      addToast('success', 'Thành công', 'Cập nhật khách hàng thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setCustomers((customers || []).filter(c => c.id !== selectedCustomer.id));
    addToast('success', 'Thành công', 'Đã xóa khách hàng.');
    handleCloseModal();
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newItem: Opportunity = {
      id: data.id || `OPP${Date.now()}`,
      name: data.name!,
      customerId: data.customerId!,
      personnelId: data.personnelId || '',
      productId: data.productId!,
      estimatedValue: data.estimatedValue || 0,
      probability: data.probability || 0,
      status: data.status || 'TIEM_NANG',
      salesId: data.salesId!,
      createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_OPPORTUNITY') {
      setOpportunities([newItem, ...opportunities]);
      addToast('success', 'Thành công', 'Thêm mới cơ hội thành công!');
    } else if (modalType === 'EDIT_OPPORTUNITY') {
      setOpportunities(opportunities.map(o => o.id === selectedOpportunity?.id ? { ...newItem, id: selectedOpportunity.id } : o));
      addToast('success', 'Thành công', 'Cập nhật cơ hội thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteOpportunity = async () => {
    if (!selectedOpportunity) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setOpportunities((opportunities || []).filter(o => o.id !== selectedOpportunity.id));
    addToast('success', 'Thành công', 'Đã xóa cơ hội kinh doanh.');
    handleCloseModal();
  };

  // --- Project Handlers ---
  const handleSaveProject = async (data: Partial<Project>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newItem: Project = {
        id: data.project_code || `DA${Date.now()}`,
        project_code: data.project_code || `DA${Date.now()}`,
        project_name: data.project_name!,
        customer_id: data.customer_id!,
        opportunity_id: data.opportunity_id || '',
        investment_mode: data.investment_mode || 'DAU_TU',
        start_date: data.start_date!,
        expected_end_date: data.expected_end_date,
        actual_end_date: data.actual_end_date,
        status: data.status || 'ACTIVE',
        items: data.items || [],
        created_at: data.created_at || new Date().toISOString().split('T')[0],
    };

    if (modalType === 'ADD_PROJECT') {
        setProjects([newItem, ...projects]);
        // Switch to project tab to show the new project
        setActiveTab('projects'); 
        addToast('success', 'Thành công', 'Thêm mới dự án thành công!');
    } else if (modalType === 'EDIT_PROJECT') {
        setProjects(projects.map(p => p.id === selectedProject?.id ? { ...newItem, id: selectedProject.id } : p));
        addToast('success', 'Thành công', 'Cập nhật dự án thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProjects((projects || []).filter(p => p.id !== selectedProject.id));
    addToast('success', 'Thành công', 'Đã xóa dự án.');
    handleCloseModal();
  };

  // --- Contract Handlers ---
  const handleSaveContract = async (data: Partial<Contract>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newItem: Contract = {
        id: data.contract_number!,
        contract_number: data.contract_number!,
        project_id: data.project_id!,
        sign_date: data.sign_date!,
        expiry_date: data.expiry_date,
        total_value: data.total_value || 0,
        status: data.status || 'DRAFT',
        created_at: data.created_at || new Date().toISOString().split('T')[0],
    };

    if (modalType === 'ADD_CONTRACT') {
        setContracts([newItem, ...contracts]);
        addToast('success', 'Thành công', 'Thêm mới hợp đồng thành công!');
    } else if (modalType === 'EDIT_CONTRACT') {
        setContracts(contracts.map(c => c.id === selectedContract?.id ? newItem : c));
        addToast('success', 'Thành công', 'Cập nhật hợp đồng thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteContract = async () => {
    if (!selectedContract) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setContracts((contracts || []).filter(c => c.id !== selectedContract.id));
    addToast('success', 'Thành công', 'Đã xóa hợp đồng.');
    handleCloseModal();
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

    const newItem: UserDeptHistory = {
        id: data.id || `LC${Date.now()}`,
        userId: data.userId!,
        fromDeptId: data.fromDeptId!,
        toDeptId: data.toDeptId!,
        transferDate: data.transferDate!,
        reason: data.reason || '',
        createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_USER_DEPT_HISTORY') {
        setUserDeptHistory([newItem, ...userDeptHistory]);
        
        // --- LOGIC NGHIỆP VỤ QUAN TRỌNG ---
        // Cập nhật phòng ban mới cho nhân sự
        setEmployees(prev => prev.map(emp => {
            if (emp.id === newItem.userId) {
                return { ...emp, department: newItem.toDeptId };
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

  // --- Dashboard Stats ---
  const OPPORTUNITY_STAGE_MAP: Record<OpportunityStatus, OpportunityStage> = {
    TIEM_NANG: 'LEAD',
    DANG_TIEP_CAN: 'QUALIFIED',
    CHAO_GIA: 'PROPOSAL',
    DU_THAU: 'NEGOTIATION',
    THUONG_THAO: 'NEGOTIATION',
    TRUNG_THAU: 'CLOSED_WON',
    THAT_THAU: 'CLOSED_LOST',
  };

  const OPPORTUNITY_STAGE_ORDER: OpportunityStage[] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
  const PROJECT_STATUS_ORDER: ProjectStatus[] = ['ACTIVE', 'COMPLETED', 'SUSPENDED'];

  const totalRevenue = (contracts || [])
    .filter((contract) => contract.status === 'SIGNED')
    .reduce((sum, contract) => sum + (contract.total_value || 0), 0);

  const pipelineByStage = OPPORTUNITY_STAGE_ORDER.map((stage) => ({
    stage,
    value: (opportunities || [])
      .filter((opp) => OPPORTUNITY_STAGE_MAP[opp.status] === stage)
      .reduce((sum, opp) => sum + (opp.estimatedValue || 0), 0),
  }));

  const projectStatusCounts = PROJECT_STATUS_ORDER.map((status) => ({
    status,
    count: (projects || []).filter((project) => project.status === status).length,
  }));

  const dashboardStats: DashboardStats = {
    totalRevenue,
    pipelineByStage,
    projectStatusCounts,
  };

  const handleConvertOpportunity = (opp: Opportunity) => {
    const product = products.find(p => p.id === opp.productId);
    const unitPrice = product ? product.standard_price : 0;
    
    const initialProjectData: Partial<Project> = {
        project_name: `Dự án: ${opp.name}`,
        customer_id: opp.customerId,
        opportunity_id: opp.id,
        status: 'ACTIVE',
        start_date: new Date().toISOString().split('T')[0],
        items: [{
            id: `ITEM_${Date.now()}`,
            productId: opp.productId,
            quantity: 1,
            unitPrice: unitPrice,
            discountPercent: 0,
            discountAmount: 0,
            lineTotal: unitPrice
        }]
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

        {activeTab === 'departments' && (
          <DepartmentList departments={departments} onOpenModal={handleOpenModal} />
        )}
        
        {activeTab === 'employees' && (
          <EmployeeList employees={employees} onOpenModal={handleOpenModal} />
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

        {/* Placeholder for other tabs */}
        {['dashboard', 'departments', 'employees', 'businesses', 'vendors', 'products', 'clients', 'cus_personnel', 'opportunities', 'projects', 'contracts', 'documents', 'reminders', 'user_dept_history'].indexOf(activeTab) === -1 && (
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
             activeTab === 'departments' ? "Nhập dữ liệu phòng ban" : 
             activeTab === 'employees' ? "Nhập dữ liệu nhân sự" :
             activeTab === 'businesses' ? "Nhập dữ liệu lĩnh vực" :
             activeTab === 'vendors' ? "Nhập dữ liệu đối tác" :
             activeTab === 'products' ? "Nhập dữ liệu sản phẩm" :
             activeTab === 'clients' ? "Nhập dữ liệu khách hàng" :
             activeTab === 'opportunities' ? "Nhập dữ liệu cơ hội" :
             activeTab === 'projects' ? "Nhập dữ liệu dự án" :
             "Nhập dữ liệu nhân sự liên hệ"
           }
           onClose={handleCloseModal}
           onSave={() => handleSaveDepartment({})}
        />
      )}

      {(modalType === 'ADD_EMPLOYEE' || modalType === 'EDIT_EMPLOYEE') && (
        <EmployeeFormModal 
          type={modalType === 'ADD_EMPLOYEE' ? 'ADD' : 'EDIT'}
          data={selectedEmployee}
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
        <ContractFormModal 
          type={modalType === 'ADD_CONTRACT' ? 'ADD' : 'EDIT'}
          data={selectedContract}
          projects={projects}
          onClose={handleCloseModal}
          onSave={handleSaveContract}
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
