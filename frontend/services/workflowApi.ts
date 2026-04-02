import { apiFetch } from '../shared/api/apiFetch';

/**
 * Workflow API services
 * 
 * Base URL: /api/v5
 */

const BASE_URL = '/api/v5';

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

// Response Types
interface ApiResponse<T> {
  data: T;
  meta?: Record<string, any>;
  message?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    [key: string]: any;
  };
}

// ============================================================================
// WORKFLOW DEFINITIONS
// ============================================================================

/**
 * List all workflows
 */
export const getWorkflows = async (
  processType: string = 'customer_request',
  includeInactive: boolean = false
): Promise<PaginatedResponse<WorkflowDefinition>> => {
  const params = new URLSearchParams({
    process_type: processType,
    include_inactive: includeInactive.toString(),
  });

  const response = await apiFetch(`${BASE_URL}/workflow-definitions?${params}`, {
    method: 'GET',
  });
  return response.json();
};

/**
 * Get workflow detail by ID
 */
export const getWorkflowById = async (id: number): Promise<ApiResponse<WorkflowDefinition>> => {
  const response = await apiFetch(`${BASE_URL}/workflow-definitions/${id}`, {
    method: 'GET',
  });
  return response.json();
};

/**
 * Get workflow by code
 */
export const getWorkflowByCode = async (code: string): Promise<ApiResponse<WorkflowDefinition>> => {
  const response = await apiFetch(`${BASE_URL}/workflow-definitions/code/${code}`, {
    method: 'GET',
  });
  return response.json();
};

/**
 * Get active workflow
 */
export const getActiveWorkflow = async (
  processType: string = 'customer_request'
): Promise<ApiResponse<WorkflowDefinition>> => {
  const params = new URLSearchParams({ process_type: processType });
  const response = await apiFetch(`${BASE_URL}/workflow-definitions/active?${params}`, {
    method: 'GET',
  });
  return response.json();
};

/**
 * Get workflow statistics
 */
export const getWorkflowStatistics = async (
  processType: string = 'customer_request'
): Promise<ApiResponse<WorkflowStatistics>> => {
  const params = new URLSearchParams({ process_type: processType });
  const response = await apiFetch(`${BASE_URL}/workflow-definitions/statistics?${params}`, {
    method: 'GET',
  });
  return response.json();
};

/**
 * Create new workflow
 */
export const createWorkflow = async (
  payload: Partial<WorkflowDefinition>
): Promise<ApiResponse<WorkflowDefinition>> => {
  return apiFetch(`${BASE_URL}/workflow-definitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

/**
 * Update workflow
 */
export const updateWorkflow = async (
  id: number,
  payload: Partial<WorkflowDefinition>
): Promise<ApiResponse<WorkflowDefinition>> => {
  try {
    const response = await apiFetch(`${BASE_URL}/workflow-definitions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API Response Error:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData,
      });
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error: any) {
    console.error('❌ Update Workflow Failed:', error);
    throw error;
  }
};

/**
 * Activate workflow
 */
export const activateWorkflow = async (id: number): Promise<ApiResponse<WorkflowDefinition>> => {
  return apiFetch(`${BASE_URL}/workflow-definitions/${id}/activate`, {
    method: 'POST',
  });
};

/**
 * Deactivate workflow
 */
export const deactivateWorkflow = async (id: number): Promise<ApiResponse<WorkflowDefinition>> => {
  return apiFetch(`${BASE_URL}/workflow-definitions/${id}/deactivate`, {
    method: 'POST',
  });
};

/**
 * Delete workflow
 */
export const deleteWorkflow = async (id: number): Promise<{ message: string }> => {
  return apiFetch(`${BASE_URL}/workflow-definitions/${id}`, {
    method: 'DELETE',
  });
};

// ============================================================================
// WORKFLOW TRANSITIONS
// ============================================================================

/**
 * List transitions for a workflow
 */
export const getTransitions = async (
  workflowId: number,
  activeOnly: boolean = true
): Promise<PaginatedResponse<WorkflowTransition>> => {
  const params = new URLSearchParams({ active_only: activeOnly.toString() });
  const response = await apiFetch(`${BASE_URL}/workflow-definitions/${workflowId}/transitions?${params}`, {
    method: 'GET',
  });
  return response.json();
};

/**
 * Get transitions from a specific status
 */
export const getTransitionsFromStatus = async (
  workflowId: number,
  fromStatusCode: string,
  activeOnly: boolean = true
): Promise<PaginatedResponse<WorkflowTransition>> => {
  const params = new URLSearchParams({ active_only: activeOnly.toString() });
  const response = await apiFetch(
    `${BASE_URL}/workflow-definitions/${workflowId}/transitions/from/${fromStatusCode}?${params}`,
    { method: 'GET' }
  );
  return response.json();
};

/**
 * Check if transition is allowed
 */
export const checkTransition = async (
  workflowId: number,
  fromStatusCode: string,
  toStatusCode: string,
  role?: string
): Promise<ApiResponse<{
  is_allowed: boolean;
  allowed_roles: string[];
  can_execute?: boolean;
}>> => {
  const params = new URLSearchParams({
    from_status_code: fromStatusCode,
    to_status_code: toStatusCode,
    ...(role && { role }),
  });
  const response = await apiFetch(
    `${BASE_URL}/workflow-definitions/${workflowId}/transitions/check?${params}`,
    { method: 'GET' }
  );
  return response.json();
};

/**
 * Create new transition
 */
export const createTransition = async (
  workflowId: number,
  payload: Partial<WorkflowTransition>
): Promise<ApiResponse<WorkflowTransition>> => {
  return apiFetch(`${BASE_URL}/workflow-definitions/${workflowId}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

/**
 * Update transition
 */
export const updateTransition = async (
  id: number,
  payload: Partial<WorkflowTransition>
): Promise<ApiResponse<WorkflowTransition>> => {
  return apiFetch(`${BASE_URL}/workflow-transitions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

/**
 * Delete transition
 */
export const deleteTransition = async (id: number): Promise<{ message: string }> => {
  return apiFetch(`${BASE_URL}/workflow-transitions/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Bulk create transitions
 */
export const bulkCreateTransitions = async (
  workflowId: number,
  transitions: Partial<WorkflowTransition>[]
): Promise<ApiResponse<WorkflowTransition[]>> => {
  return apiFetch(`${BASE_URL}/workflow-definitions/${workflowId}/transitions/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transitions }),
  });
};

/**
 * Import transitions from Excel data
 */
export const importTransitions = async (
  workflowId: number,
  transitions: Partial<WorkflowTransition>[],
  skipDuplicates: boolean = false,
  updateExisting: boolean = false
): Promise<ApiResponse<{
  success: number;
  skipped: number;
  updated: number;
  errors: string[];
}>> => {
  return apiFetch(`${BASE_URL}/workflow-definitions/${workflowId}/transitions/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transitions,
      skip_duplicates: skipDuplicates,
      update_existing: updateExisting,
    }),
  });
};

/**
 * Get transition statistics
 */
export const getTransitionStatistics = async (
  workflowId: number
): Promise<ApiResponse<TransitionStatistics>> => {
  const response = await apiFetch(`${BASE_URL}/workflow-definitions/${workflowId}/transitions/statistics`, {
    method: 'GET',
  });
  return response.json();
};
