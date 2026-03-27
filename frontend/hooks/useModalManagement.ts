import { useState, useCallback, useRef } from 'react';
import type { ModalType, Department, Employee, Business, Vendor, Product, Customer, CustomerPersonnel, Project, Contract, Document, Reminder, UserDeptHistory, FeedbackRequest } from '../types';

interface ModalState {
  modalType: ModalType;
  importModuleOverride: string | null;
}

interface SelectedItems {
  selectedDept: Department | null;
  selectedEmployee: Employee | null;
  selectedBusiness: Business | null;
  selectedVendor: Vendor | null;
  selectedProduct: Product | null;
  selectedCustomer: Customer | null;
  selectedCusPersonnel: CustomerPersonnel | null;
  selectedProject: Project | null;
  selectedContract: Contract | null;
  selectedDocument: Document | null;
  selectedReminder: Reminder | null;
  selectedUserDeptHistory: UserDeptHistory | null;
  selectedFeedback: FeedbackRequest | null;
}

interface ModalManagementState extends ModalState, SelectedItems {
  projectModalInitialTab: 'info' | 'items' | 'raci';
  isContractDetailLoading: boolean;
  isFeedbackDetailLoading: boolean;
  contractAddPrefill: Partial<Contract> | null;
  employeeProvisioning: { employeeLabel: string; provisioning: { temporary_password: string } } | null;
  isEmployeePasswordResetting: boolean;
  productDeleteDependencyMessage: string | null;
}

interface UseModalManagementReturn {
  modalState: ModalState;
  selectedItems: SelectedItems;
  projectModalInitialTab: 'info' | 'items' | 'raci';
  isContractDetailLoading: boolean;
  isFeedbackDetailLoading: boolean;
  contractAddPrefill: Partial<Contract> | null;
  employeeProvisioning: { employeeLabel: string; provisioning: { temporary_password: string } } | null;
  isEmployeePasswordResetting: boolean;
  productDeleteDependencyMessage: string | null;
  handleOpenModal: (
    type: ModalType,
    item?: any,
    options?: {
      prefillContract?: Partial<Contract>;
      initialProjectTab?: 'info' | 'items' | 'raci';
    }
  ) => void;
  handleOpenImportModalForModule: (moduleKey: string) => void;
  handleCloseModal: () => void;
  setEmployeeProvisioning: (value: { employeeLabel: string; provisioning: { temporary_password: string } } | null) => void;
  setProductDeleteDependencyMessage: (value: string | null) => void;
}

export function useModalManagement(): UseModalManagementReturn {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [importModuleOverride, setImportModuleOverride] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCusPersonnel, setSelectedCusPersonnel] = useState<CustomerPersonnel | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [selectedUserDeptHistory, setSelectedUserDeptHistory] = useState<UserDeptHistory | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRequest | null>(null);
  const [projectModalInitialTab, setProjectModalInitialTab] = useState<'info' | 'items' | 'raci'>('info');
  const [isContractDetailLoading, setIsContractDetailLoading] = useState(false);
  const [isFeedbackDetailLoading, setIsFeedbackDetailLoading] = useState(false);
  const [contractAddPrefill, setContractAddPrefill] = useState<Partial<Contract> | null>(null);
  const [employeeProvisioning, setEmployeeProvisioningState] = useState<{ employeeLabel: string; provisioning: { temporary_password: string } } | null>(null);
  const [isEmployeePasswordResetting, setIsEmployeePasswordResetting] = useState(false);
  const [productDeleteDependencyMessage, setProductDeleteDependencyMessage] = useState<string | null>(null);

  const projectDetailLoadVersionRef = useRef(0);
  const contractDetailLoadVersionRef = useRef(0);

  const resetSelectedItems = useCallback(() => {
    setSelectedDept(null);
    setSelectedEmployee(null);
    setSelectedBusiness(null);
    setSelectedVendor(null);
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setSelectedCusPersonnel(null);
    setSelectedProject(null);
    setSelectedContract(null);
    setSelectedDocument(null);
    setSelectedReminder(null);
    setSelectedUserDeptHistory(null);
    setSelectedFeedback(null);
    setProjectModalInitialTab('info');
    setIsContractDetailLoading(false);
    setIsFeedbackDetailLoading(false);
    setContractAddPrefill(null);
  }, []);

  const handleOpenModal = useCallback((
    type: ModalType,
    item?: any,
    options?: {
      prefillContract?: Partial<Contract>;
      initialProjectTab?: 'info' | 'items' | 'raci';
    }
  ) => {
    // Increment version refs for detail loading
    projectDetailLoadVersionRef.current += 1;
    contractDetailLoadVersionRef.current += 1;

    // Reset selections
    resetSelectedItems();
    setImportModuleOverride(null);
    setIsEmployeePasswordResetting(false);

    // Set modal type
    setModalType(type);

    // Handle special cases
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
    } else if (type?.includes('PROJECT')) {
      setSelectedProject(item as Project);
      if (type === 'EDIT_PROJECT' && item?.id) {
        setProjectModalInitialTab(options?.initialProjectTab ?? 'info');
      }
    } else if (type?.includes('CONTRACT')) {
      if (type === 'ADD_CONTRACT' && options?.prefillContract) {
        setContractAddPrefill(options.prefillContract);
      } else if (type === 'EDIT_CONTRACT' && item?.id) {
        setIsContractDetailLoading(true);
      }
      setSelectedContract(item as Contract);
    } else if (type?.includes('DOCUMENT')) {
      setSelectedDocument(item as Document);
    } else if (type?.includes('REMINDER')) {
      setSelectedReminder(item as Reminder);
    } else if (type?.includes('USER_DEPT_HISTORY')) {
      setSelectedUserDeptHistory(item as UserDeptHistory);
    } else if (type === 'VIEW_FEEDBACK' || type === 'EDIT_FEEDBACK') {
      setSelectedFeedback(item as FeedbackRequest);
      if (item?.id) {
        setIsFeedbackDetailLoading(true);
      }
    } else if (type === 'ADD_FEEDBACK' || type === 'DELETE_FEEDBACK') {
      setSelectedFeedback(item as FeedbackRequest);
    } else if (item && 'dept_code' in item) {
      setSelectedDept(item as Department);
    }
  }, [resetSelectedItems]);

  const handleOpenImportModalForModule = useCallback((moduleKey: string) => {
    setImportModuleOverride(moduleKey);
    setModalType('IMPORT_DATA');
  }, []);

  const handleCloseModal = useCallback(() => {
    projectDetailLoadVersionRef.current += 1;
    contractDetailLoadVersionRef.current += 1;
    setModalType(null);
    setImportModuleOverride(null);
    setIsEmployeePasswordResetting(false);
    resetSelectedItems();
    setProductDeleteDependencyMessage(null);
  }, [resetSelectedItems]);

  return {
    modalState: {
      modalType,
      importModuleOverride,
    },
    selectedItems: {
      selectedDept,
      selectedEmployee,
      selectedBusiness,
      selectedVendor,
      selectedProduct,
      selectedCustomer,
      selectedCusPersonnel,
      selectedProject,
      selectedContract,
      selectedDocument,
      selectedReminder,
      selectedUserDeptHistory,
      selectedFeedback,
    },
    projectModalInitialTab,
    isContractDetailLoading,
    isFeedbackDetailLoading,
    contractAddPrefill,
    employeeProvisioning,
    isEmployeePasswordResetting,
    productDeleteDependencyMessage,
    handleOpenModal,
    handleOpenImportModalForModule,
    handleCloseModal,
    setEmployeeProvisioning: setEmployeeProvisioningState,
    setProductDeleteDependencyMessage,
  };
}