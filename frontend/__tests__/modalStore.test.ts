import { beforeEach, describe, expect, it } from 'vitest';
import { useModalStore } from '../shared/stores';

const resetModalStore = () => {
  useModalStore.setState({
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
  });
};

describe('useModalStore', () => {
  beforeEach(() => {
    resetModalStore();
  });

  it('opens a modal with a fresh context while preserving the separate procedure modal state', () => {
    useModalStore.getState().openProcedureModal({
      id: 99,
      project_name: 'Quy trinh dang mo',
    } as any);

    useModalStore.setState({
      activeModal: 'DELETE_PRODUCT',
      selectedProduct: {
        id: 501,
        product_name: 'San pham cu',
      } as any,
    });

    useModalStore.getState().openModal('EDIT_CUSTOMER', {
      importModuleOverride: 'clients',
      selectedCustomer: {
        id: 10,
        customer_name: 'Khach hang moi',
      } as any,
    });

    expect(useModalStore.getState()).toMatchObject({
      activeModal: 'EDIT_CUSTOMER',
      importModuleOverride: 'clients',
      selectedCustomer: expect.objectContaining({
        customer_name: 'Khach hang moi',
      }),
      selectedProduct: null,
      procedureProject: expect.objectContaining({
        project_name: 'Quy trinh dang mo',
      }),
    });
  });

  it('resets modal selections without dropping the currently active modal', () => {
    useModalStore.setState({
      activeModal: 'EDIT_CONTRACT',
      selectedContract: {
        id: 88,
        contract_name: 'Hop dong dang sua',
      } as any,
      projectModalInitialTab: 'raci',
      productDeleteDependencyMessage: 'Dang co rang buoc',
    });

    useModalStore.getState().resetModalSelections();

    expect(useModalStore.getState()).toMatchObject({
      activeModal: 'EDIT_CONTRACT',
      selectedContract: null,
      projectModalInitialTab: 'info',
      productDeleteDependencyMessage: null,
    });
  });

  it('closes the active modal without touching the procedure modal until asked', () => {
    useModalStore.getState().openProcedureModal({
      id: 77,
      project_name: 'Du an thu tuc',
    } as any);
    useModalStore.getState().openModal('EDIT_PROJECT', {
      selectedProject: {
        id: 7,
        project_name: 'Du an dang sua',
      } as any,
    });

    useModalStore.getState().closeModal();

    expect(useModalStore.getState()).toMatchObject({
      activeModal: null,
      selectedProject: null,
      procedureProject: expect.objectContaining({
        project_name: 'Du an thu tuc',
      }),
    });

    useModalStore.getState().closeProcedureModal();

    expect(useModalStore.getState().procedureProject).toBeNull();
  });
});
