import { create } from 'zustand';

/**
 * Workflow store for Workflow Management UI state
 * 
 * Manages state for workflow definitions and transitions management
 */

// Types
export interface WorkflowDefinition {
  id: number;
  code: string;
  name: string;
  description?: string;
  process_type: string;
  is_active: boolean;
  is_default: boolean;
  version: string;
  config?: Record<string, any>;
  activated_at?: string;
  created_at: string;
  updated_at: string;
  transitions?: WorkflowTransition[];
}

export interface WorkflowTransition {
  id: number;
  workflow_definition_id: number;
  from_status_code: string;
  to_status_code: string;
  from_status_name?: string;
  to_status_name?: string;
  allowed_roles: string[];
  required_fields?: string[];
  transition_config?: Record<string, any>;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowStatistics {
  total_workflows: number;
  active_workflows: number;
  inactive_workflows: number;
  default_workflows: number;
  total_transitions: number;
}

export interface TransitionStatistics {
  total_transitions: number;
  active_transitions: number;
  inactive_transitions: number;
  allowed_roles_all: number;
  allowed_roles_R: number;
  allowed_roles_A: number;
  unique_from_statuses: number;
  unique_to_statuses: number;
  from_status_codes: string[];
  to_status_codes: string[];
}

// Store State
interface WorkflowState {
  // Workflow Definitions
  workflows: WorkflowDefinition[];
  selectedWorkflow: WorkflowDefinition | null;
  workflowStatistics: WorkflowStatistics | null;
  
  // Transitions
  transitions: WorkflowTransition[];
  transitionStatistics: TransitionStatistics | null;
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
  
  // Modal State
  showCreateModal: boolean;
  showEditModal: boolean;
  showTransitionMatrix: boolean;
  showImportModal: boolean;
  
  // Filters
  processTypeFilter: string;
  includeInactive: boolean;
  
  // Actions - Workflow Definitions
  setWorkflows: (workflows: WorkflowDefinition[]) => void;
  setSelectedWorkflow: (workflow: WorkflowDefinition | null) => void;
  setWorkflowStatistics: (stats: WorkflowStatistics | null) => void;
  addWorkflow: (workflow: WorkflowDefinition) => void;
  updateWorkflow: (workflow: WorkflowDefinition) => void;
  removeWorkflow: (id: number) => void;
  
  // Actions - Transitions
  setTransitions: (transitions: WorkflowTransition[]) => void;
  setTransitionStatistics: (stats: TransitionStatistics | null) => void;
  addTransition: (transition: WorkflowTransition) => void;
  updateTransition: (transition: WorkflowTransition) => void;
  removeTransition: (id: number) => void;
  
  // Actions - UI
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
  
  // Actions - Modals
  setShowCreateModal: (show: boolean) => void;
  setShowEditModal: (show: boolean) => void;
  setShowTransitionMatrix: (show: boolean) => void;
  setShowImportModal: (show: boolean) => void;
  
  // Actions - Filters
  setProcessTypeFilter: (type: string) => void;
  setIncludeInactive: (include: boolean) => void;
  
  // Actions - Clear
  clearWorkflowState: () => void;
  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  // Initial State
  workflows: [],
  selectedWorkflow: null,
  workflowStatistics: null,
  
  transitions: [],
  transitionStatistics: null,
  
  isLoading: false,
  isSaving: false,
  error: null,
  successMessage: null,
  
  showCreateModal: false,
  showEditModal: false,
  showTransitionMatrix: false,
  showImportModal: false,
  
  processTypeFilter: 'customer_request',
  includeInactive: false,
  
  // Workflow Definitions Actions
  setWorkflows: (workflows) => set({ workflows }),
  
  setSelectedWorkflow: (workflow) => set({ selectedWorkflow: workflow }),
  
  setWorkflowStatistics: (stats) => set({ workflowStatistics: stats }),
  
  addWorkflow: (workflow) => set((state) => ({
    workflows: [...state.workflows, workflow],
  })),
  
  updateWorkflow: (workflow) => set((state) => ({
    workflows: state.workflows.map((w) => (w.id === workflow.id ? workflow : w)),
    selectedWorkflow: state.selectedWorkflow?.id === workflow.id ? workflow : state.selectedWorkflow,
  })),
  
  removeWorkflow: (id) => set((state) => ({
    workflows: state.workflows.filter((w) => w.id !== id),
    selectedWorkflow: state.selectedWorkflow?.id === id ? null : state.selectedWorkflow,
  })),
  
  // Transitions Actions
  setTransitions: (transitions) => set({ transitions }),
  
  setTransitionStatistics: (stats) => set({ transitionStatistics: stats }),
  
  addTransition: (transition) => set((state) => ({
    transitions: [...state.transitions, transition],
  })),
  
  updateTransition: (transition) => set((state) => ({
    transitions: state.transitions.map((t) => (t.id === transition.id ? transition : t)),
  })),
  
  removeTransition: (id) => set((state) => ({
    transitions: state.transitions.filter((t) => t.id !== id),
  })),
  
  // UI Actions
  setLoading: (loading) => set({ isLoading: loading }),
  
  setSaving: (saving) => set({ isSaving: saving }),
  
  setError: (error) => set({ error, successMessage: error ? null : state.successMessage }),
  
  setSuccessMessage: (message) => set({ successMessage: message, error: message ? null : state.error }),
  
  // Modal Actions
  setShowCreateModal: (show) => set({ showCreateModal: show }),
  
  setShowEditModal: (show) => set({ showEditModal: show }),
  
  setShowTransitionMatrix: (show) => set({ showTransitionMatrix: show }),
  
  setShowImportModal: (show) => set({ showImportModal: show }),
  
  // Filter Actions
  setProcessTypeFilter: (type) => set({ processTypeFilter: type }),
  
  setIncludeInactive: (include) => set({ includeInactive: include }),
  
  // Clear Actions
  clearWorkflowState: () => set({
    workflows: [],
    selectedWorkflow: null,
    workflowStatistics: null,
    transitions: [],
    transitionStatistics: null,
    error: null,
    successMessage: null,
  }),
  
  clearError: () => set({ error: null }),
}));
