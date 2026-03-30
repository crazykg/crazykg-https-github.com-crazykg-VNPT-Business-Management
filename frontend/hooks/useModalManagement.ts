import { useCallback, useEffect, useState } from 'react';
import {
  fetchContractDetail,
  fetchProjectDetail,
  isRequestCanceledError,
} from '../services/v5Api';
import { useModalStore } from '../shared/stores';
import type {
  Business,
  Contract,
  Customer,
  CustomerPersonnel,
  Department,
  Document,
  Employee,
  EmployeePartyProfile,
  EmployeeProvisioning,
  FeedbackRequest,
  ModalType,
  Product,
  Project,
  Reminder,
  UserDeptHistory,
  Vendor,
} from '../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface UseModalManagementReturn {
  modalType: ModalType;
  importModuleOverride: string | null;
  selectedDept: Department | null;
  selectedEmployee: Employee | null;
  selectedPartyProfile: EmployeePartyProfile | null;
  selectedBusiness: Business | null;
  selectedVendor: Vendor | null;
  selectedProduct: Product | null;
  productDeleteDependencyMessage: string | null;
  selectedCustomer: Customer | null;
  selectedCusPersonnel: CustomerPersonnel | null;
  selectedProject: Project | null;
  projectModalInitialTab: 'info' | 'items' | 'raci';
  selectedContract: Contract | null;
  contractAddPrefill: Partial<Contract> | null;
  selectedDocument: Document | null;
  selectedReminder: Reminder | null;
  selectedUserDeptHistory: UserDeptHistory | null;
  selectedFeedback: FeedbackRequest | null;
  procedureProject: Project | null;
  isContractDetailLoading: boolean;
  isFeedbackDetailLoading: boolean;
  employeeProvisioning: { employeeLabel: string; provisioning: EmployeeProvisioning } | null;
  isEmployeePasswordResetting: boolean;
  setModalType: (type: ModalType) => void;
  setImportModuleOverride: (value: string | null) => void;
  setSelectedDept: (value: Department | null) => void;
  setSelectedEmployee: (value: Employee | null) => void;
  setSelectedPartyProfile: (value: EmployeePartyProfile | null) => void;
  setSelectedBusiness: (value: Business | null) => void;
  setSelectedVendor: (value: Vendor | null) => void;
  setSelectedProduct: (value: Product | null) => void;
  setProductDeleteDependencyMessage: (value: string | null) => void;
  setSelectedCustomer: (value: Customer | null) => void;
  setSelectedCusPersonnel: (value: CustomerPersonnel | null) => void;
  setSelectedProject: (value: Project | null) => void;
  setSelectedContract: (value: Contract | null) => void;
  setSelectedDocument: (value: Document | null) => void;
  setSelectedReminder: (value: Reminder | null) => void;
  setSelectedUserDeptHistory: (value: UserDeptHistory | null) => void;
  setSelectedFeedback: (value: FeedbackRequest | null) => void;
  setProcedureProject: (value: Project | null) => void;
  setEmployeeProvisioning: (value: { employeeLabel: string; provisioning: EmployeeProvisioning } | null) => void;
  setIsEmployeePasswordResetting: (value: boolean) => void;
  resetModalSelections: () => void;
  handleOpenModal: (type: ModalType, item?: unknown) => void;
  handleCloseModal: () => void;
}

export function useModalManagement(addToast?: ToastFn): UseModalManagementReturn {
  const modalType = useModalStore((state) => state.activeModal);
  const importModuleOverride = useModalStore((state) => state.importModuleOverride);
  const selectedDept = useModalStore((state) => state.selectedDept);
  const selectedEmployee = useModalStore((state) => state.selectedEmployee);
  const selectedPartyProfile = useModalStore((state) => state.selectedPartyProfile);
  const selectedBusiness = useModalStore((state) => state.selectedBusiness);
  const selectedVendor = useModalStore((state) => state.selectedVendor);
  const selectedProduct = useModalStore((state) => state.selectedProduct);
  const productDeleteDependencyMessage = useModalStore((state) => state.productDeleteDependencyMessage);
  const selectedCustomer = useModalStore((state) => state.selectedCustomer);
  const selectedCusPersonnel = useModalStore((state) => state.selectedCusPersonnel);
  const selectedProject = useModalStore((state) => state.selectedProject);
  const projectModalInitialTab = useModalStore((state) => state.projectModalInitialTab);
  const selectedContract = useModalStore((state) => state.selectedContract);
  const contractAddPrefill = useModalStore((state) => state.contractAddPrefill);
  const selectedDocument = useModalStore((state) => state.selectedDocument);
  const selectedReminder = useModalStore((state) => state.selectedReminder);
  const selectedUserDeptHistory = useModalStore((state) => state.selectedUserDeptHistory);
  const selectedFeedback = useModalStore((state) => state.selectedFeedback);
  const procedureProject = useModalStore((state) => state.procedureProject);
  const patchModalState = useModalStore((state) => state.patchModalState);
  const resetModalSelectionsState = useModalStore((state) => state.resetModalSelections);
  const closeModalState = useModalStore((state) => state.closeModal);
  const openProcedureModal = useModalStore((state) => state.openProcedureModal);
  const closeProcedureModal = useModalStore((state) => state.closeProcedureModal);

  const [isContractDetailLoading, setIsContractDetailLoading] = useState(false);
  const [isFeedbackDetailLoading, setIsFeedbackDetailLoading] = useState(false);
  const [employeeProvisioning, setEmployeeProvisioning] = useState<{ employeeLabel: string; provisioning: EmployeeProvisioning } | null>(null);
  const [isEmployeePasswordResetting, setIsEmployeePasswordResetting] = useState(false);

  const setModalType = useCallback((type: ModalType) => {
    if (!type) {
      closeModalState();
      setIsContractDetailLoading(false);
      setIsFeedbackDetailLoading(false);
      return;
    }

    patchModalState({ activeModal: type });
  }, [closeModalState, patchModalState]);

  const setImportModuleOverride = useCallback((value: string | null) => {
    patchModalState({ importModuleOverride: value });
  }, [patchModalState]);

  const setSelectedDept = useCallback((value: Department | null) => {
    patchModalState({ selectedDept: value });
  }, [patchModalState]);

  const setSelectedEmployee = useCallback((value: Employee | null) => {
    patchModalState({ selectedEmployee: value });
  }, [patchModalState]);

  const setSelectedPartyProfile = useCallback((value: EmployeePartyProfile | null) => {
    patchModalState({ selectedPartyProfile: value });
  }, [patchModalState]);

  const setSelectedBusiness = useCallback((value: Business | null) => {
    patchModalState({ selectedBusiness: value });
  }, [patchModalState]);

  const setSelectedVendor = useCallback((value: Vendor | null) => {
    patchModalState({ selectedVendor: value });
  }, [patchModalState]);

  const setSelectedProduct = useCallback((value: Product | null) => {
    patchModalState({ selectedProduct: value });
  }, [patchModalState]);

  const setProductDeleteDependencyMessage = useCallback((value: string | null) => {
    patchModalState({ productDeleteDependencyMessage: value });
  }, [patchModalState]);

  const setSelectedCustomer = useCallback((value: Customer | null) => {
    patchModalState({ selectedCustomer: value });
  }, [patchModalState]);

  const setSelectedCusPersonnel = useCallback((value: CustomerPersonnel | null) => {
    patchModalState({ selectedCusPersonnel: value });
  }, [patchModalState]);

  const setSelectedProject = useCallback((value: Project | null) => {
    patchModalState({ selectedProject: value });
  }, [patchModalState]);

  const setSelectedContract = useCallback((value: Contract | null) => {
    patchModalState({ selectedContract: value });
  }, [patchModalState]);

  const setSelectedDocument = useCallback((value: Document | null) => {
    patchModalState({ selectedDocument: value });
  }, [patchModalState]);

  const setSelectedReminder = useCallback((value: Reminder | null) => {
    patchModalState({ selectedReminder: value });
  }, [patchModalState]);

  const setSelectedUserDeptHistory = useCallback((value: UserDeptHistory | null) => {
    patchModalState({ selectedUserDeptHistory: value });
  }, [patchModalState]);

  const setSelectedFeedback = useCallback((value: FeedbackRequest | null) => {
    patchModalState({ selectedFeedback: value });
  }, [patchModalState]);

  const setProcedureProject = useCallback((value: Project | null) => {
    if (value) {
      openProcedureModal(value);
      return;
    }

    closeProcedureModal();
  }, [closeProcedureModal, openProcedureModal]);

  const resetModalSelections = useCallback(() => {
    resetModalSelectionsState();
    setIsContractDetailLoading(false);
    setIsFeedbackDetailLoading(false);
  }, [resetModalSelectionsState]);

  const handleOpenModal = useCallback((type: ModalType, item?: unknown) => {
    resetModalSelections();
    setImportModuleOverride(null);
    setIsEmployeePasswordResetting(false);

    if (!type) {
      setModalType(type);
      return;
    }

    if (type === 'EDIT_PROJECT' && item && typeof item === 'object' && 'id' in item) {
      const project = item as Project;

      void (async () => {
        try {
          const detail = await fetchProjectDetail(project.id);
          setSelectedProject(detail);
          setModalType(type);
        } catch (error) {
          if (isRequestCanceledError(error)) {
            return;
          }

          const message = error instanceof Error ? error.message : 'Không thể tải chi tiết dự án.';
          addToast?.('error', 'Tải dữ liệu thất bại', message);
        }
      })();

      return;
    }

    setModalType(type);

    if (type === 'ADD_PARTY_PROFILE' || type === 'EDIT_PARTY_PROFILE') {
      setSelectedPartyProfile((item as EmployeePartyProfile) ?? null);
      return;
    }

    if (type === 'ADD_USER_DEPT_HISTORY' && item && typeof item === 'object' && 'username' in item) {
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

    if (type.includes('DEPARTMENT')) {
      setSelectedDept((item as Department) ?? null);
      return;
    }

    if (type.includes('EMPLOYEE')) {
      setSelectedEmployee((item as Employee) ?? null);
      return;
    }

    if (type.includes('BUSINESS')) {
      setSelectedBusiness((item as Business) ?? null);
      return;
    }

    if (type.includes('VENDOR')) {
      setSelectedVendor((item as Vendor) ?? null);
      return;
    }

    if (type.includes('PRODUCT')) {
      setSelectedProduct((item as Product) ?? null);
      return;
    }

    if (type.includes('CUSTOMER')) {
      setSelectedCustomer((item as Customer) ?? null);
      return;
    }

    if (type.includes('CUS_PERSONNEL')) {
      setSelectedCusPersonnel((item as CustomerPersonnel) ?? null);
      return;
    }

    if (type.includes('PROJECT')) {
      setSelectedProject((item as Project) ?? null);
      return;
    }

    if (type.includes('CONTRACT')) {
      if (type === 'EDIT_CONTRACT' && item && typeof item === 'object' && 'id' in item) {
        setIsContractDetailLoading(true);
      }
      setSelectedContract((item as Contract) ?? null);
      return;
    }

    if (type.includes('DOCUMENT')) {
      setSelectedDocument((item as Document) ?? null);
      return;
    }

    if (type.includes('REMINDER')) {
      setSelectedReminder((item as Reminder) ?? null);
      return;
    }

    if (type.includes('USER_DEPT_HISTORY')) {
      setSelectedUserDeptHistory((item as UserDeptHistory) ?? null);
      return;
    }

    if (type === 'VIEW_FEEDBACK' || type === 'EDIT_FEEDBACK' || type === 'ADD_FEEDBACK' || type === 'DELETE_FEEDBACK') {
      const feedback = (item as FeedbackRequest) ?? null;
      setSelectedFeedback(feedback);
      if ((type === 'VIEW_FEEDBACK' || type === 'EDIT_FEEDBACK') && feedback?.id) {
        setIsFeedbackDetailLoading(true);
      }
    }
  }, [
    addToast,
    resetModalSelections,
    setImportModuleOverride,
    setModalType,
    setSelectedBusiness,
    setSelectedContract,
    setSelectedCusPersonnel,
    setSelectedCustomer,
    setSelectedDept,
    setSelectedDocument,
    setSelectedEmployee,
    setSelectedFeedback,
    setSelectedPartyProfile,
    setSelectedProduct,
    setSelectedProject,
    setSelectedReminder,
    setSelectedUserDeptHistory,
    setSelectedVendor,
  ]);

  useEffect(() => {
    if (modalType !== 'EDIT_CONTRACT' || !selectedContract?.id || !isContractDetailLoading) {
      return;
    }

    let cancelled = false;

    const loadSelectedContractDetail = async () => {
      try {
        const detail = await fetchContractDetail(selectedContract.id);
        if (cancelled) {
          return;
        }
        setSelectedContract(detail);
      } catch (error) {
        if (cancelled || isRequestCanceledError(error)) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Không thể tải chi tiết hợp đồng.';
        addToast?.('error', 'Tải dữ liệu thất bại', message);
      } finally {
        if (!cancelled) {
          setIsContractDetailLoading(false);
        }
      }
    };

    void loadSelectedContractDetail();

    return () => {
      cancelled = true;
    };
  }, [addToast, isContractDetailLoading, modalType, selectedContract?.id, setSelectedContract]);

  const handleCloseModal = useCallback(() => {
    setModalType(null);
    setImportModuleOverride(null);
    setIsEmployeePasswordResetting(false);
    setProductDeleteDependencyMessage(null);
  }, [setImportModuleOverride, setModalType, setProductDeleteDependencyMessage]);

  return {
    modalType,
    importModuleOverride,
    selectedDept,
    selectedEmployee,
    selectedPartyProfile,
    selectedBusiness,
    selectedVendor,
    selectedProduct,
    productDeleteDependencyMessage,
    selectedCustomer,
    selectedCusPersonnel,
    selectedProject,
    projectModalInitialTab,
    selectedContract,
    contractAddPrefill,
    selectedDocument,
    selectedReminder,
    selectedUserDeptHistory,
    selectedFeedback,
    procedureProject,
    isContractDetailLoading,
    isFeedbackDetailLoading,
    employeeProvisioning,
    isEmployeePasswordResetting,
    setModalType,
    setImportModuleOverride,
    setSelectedDept,
    setSelectedEmployee,
    setSelectedPartyProfile,
    setSelectedBusiness,
    setSelectedVendor,
    setSelectedProduct,
    setProductDeleteDependencyMessage,
    setSelectedCustomer,
    setSelectedCusPersonnel,
    setSelectedProject,
    setSelectedContract,
    setSelectedDocument,
    setSelectedReminder,
    setSelectedUserDeptHistory,
    setSelectedFeedback,
    setProcedureProject,
    setEmployeeProvisioning,
    setIsEmployeePasswordResetting,
    resetModalSelections,
    handleOpenModal,
    handleCloseModal,
  };
}
