import { create } from 'zustand';
import type {
  Business,
  Contract,
  Customer,
  CustomerPersonnel,
  Department,
  Document,
  Employee,
  EmployeePartyProfile,
  FeedbackRequest,
  ModalType,
  Product,
  Project,
  Reminder,
  UserDeptHistory,
  Vendor,
} from '../../types';

type ProjectModalInitialTab = 'info' | 'items' | 'raci';

export interface ModalStoreSnapshot {
  activeModal: ModalType;
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
  projectModalInitialTab: ProjectModalInitialTab;
  selectedContract: Contract | null;
  contractAddPrefill: Partial<Contract> | null;
  selectedDocument: Document | null;
  selectedReminder: Reminder | null;
  selectedUserDeptHistory: UserDeptHistory | null;
  selectedFeedback: FeedbackRequest | null;
  procedureProject: Project | null;
}

const DEFAULT_MODAL_SNAPSHOT: ModalStoreSnapshot = {
  activeModal: null,
  importModuleOverride: null,
  selectedDept: null,
  selectedEmployee: null,
  selectedPartyProfile: null,
  selectedBusiness: null,
  selectedVendor: null,
  selectedProduct: null,
  productDeleteDependencyMessage: null,
  selectedCustomer: null,
  selectedCusPersonnel: null,
  selectedProject: null,
  projectModalInitialTab: 'info',
  selectedContract: null,
  contractAddPrefill: null,
  selectedDocument: null,
  selectedReminder: null,
  selectedUserDeptHistory: null,
  selectedFeedback: null,
  procedureProject: null,
};

type ModalStorePatch = Partial<ModalStoreSnapshot>;

interface ModalStoreState extends ModalStoreSnapshot {
  openModal: (type: Exclude<ModalType, null>, patch?: ModalStorePatch) => void;
  patchModalState: (patch: ModalStorePatch) => void;
  resetModalSelections: () => void;
  closeModal: () => void;
  openProcedureModal: (project: Project) => void;
  closeProcedureModal: () => void;
}

const buildSelectionResetState = (state: ModalStoreSnapshot): ModalStoreSnapshot => ({
  ...DEFAULT_MODAL_SNAPSHOT,
  activeModal: state.activeModal,
  procedureProject: state.procedureProject,
});

export const useModalStore = create<ModalStoreState>((set) => ({
  ...DEFAULT_MODAL_SNAPSHOT,

  openModal: (type, patch = {}) =>
    set((state) => ({
      ...buildSelectionResetState(state),
      activeModal: type,
      ...patch,
    })),

  patchModalState: (patch) => set(patch),

  resetModalSelections: () =>
    set((state) => buildSelectionResetState(state)),

  closeModal: () =>
    set((state) => ({
      ...DEFAULT_MODAL_SNAPSHOT,
      procedureProject: state.procedureProject,
    })),

  openProcedureModal: (project) => set({ procedureProject: project }),

  closeProcedureModal: () => set({ procedureProject: null }),
}));
