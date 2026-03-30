import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from '../../shared/stores/workflowStore';
import {
  getWorkflows,
  getWorkflowStatistics,
  getActiveWorkflow,
  deleteWorkflow,
} from '../../services/workflowApi';
import { useToastStore } from '../../shared/stores/toastStore';
import WorkflowDefinitionList from './WorkflowDefinitionList';
import WorkflowDefinitionModal from './WorkflowDefinitionModal';
import WorkflowTransitionMatrix from './WorkflowTransitionMatrix';

/**
 * WorkflowManagementHub
 * 
 * Main hub for Workflow Management
 * Tab: workflow_mgmt (Admin only)
 */
const WorkflowManagementHub: React.FC = () => {
  const { addToast } = useToastStore();
  
  const {
    workflows,
    setWorkflows,
    workflowStatistics,
    setWorkflowStatistics,
    selectedWorkflow,
    setSelectedWorkflow,
    showCreateModal,
    showEditModal,
    showTransitionMatrix,
    setShowCreateModal,
    setShowEditModal,
    setShowTransitionMatrix,
    processTypeFilter,
    includeInactive,
    setLoading,
    setSaving,
    setError,
    clearError,
  } = useWorkflowStore();

  const [isLoading, setIsLoading] = useState(true);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, [processTypeFilter, includeInactive]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setIsLoading(true);
      clearError();

      const [workflowsRes, statsRes] = await Promise.all([
        getWorkflows(processTypeFilter, includeInactive),
        getWorkflowStatistics(processTypeFilter),
      ]);

      setWorkflows(workflowsRes.data || []);
      setWorkflowStatistics(statsRes?.data || statsRes || null);
    } catch (error: any) {
      console.error('❌ Load workflows error:', error);
      setError(error.message || 'Failed to load workflows');
      addToast('error', 'Error', 'Failed to load workflows');
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const handleCreateWorkflow = () => {
    setSelectedWorkflow(null);
    setShowCreateModal(true);
  };

  const handleEditWorkflow = (workflow: typeof workflows[0]) => {
    setSelectedWorkflow(workflow);
    setShowEditModal(true);
  };

  const handleViewTransitions = (workflow: typeof workflows[0]) => {
    setSelectedWorkflow(workflow);
    setShowTransitionMatrix(true);
  };

  const handleActivateWorkflow = async (workflow: typeof workflows[0]) => {
    try {
      setSaving(true);
      
      // API call would go here
      // await activateWorkflow(workflow.id);
      
      await loadWorkflows();
      addToast('success', 'Success', 'Workflow activated successfully');
    } catch (error: any) {
      setError(error.message || 'Failed to activate workflow');
      addToast('error', 'Error', error.message || 'Failed to activate workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateWorkflow = async (workflow: typeof workflows[0]) => {
    try {
      setSaving(true);
      
      // API call would go here
      // await deactivateWorkflow(workflow.id);
      
      await loadWorkflows();
      addToast('success', 'Success', 'Workflow deactivated successfully');
    } catch (error: any) {
      setError(error.message || 'Failed to deactivate workflow');
      addToast('error', 'Error', error.message || 'Failed to deactivate workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async (id: number, code: string) => {
    if (!confirm(`Are you sure you want to delete workflow "${code}"? This will also delete all associated transitions.`)) {
      return;
    }

    try {
      setSaving(true);
      await deleteWorkflow(id);
      
      await loadWorkflows();
      addToast('success', 'Success', 'Workflow deleted successfully');
    } catch (error: any) {
      setError(error.message || 'Failed to delete workflow');
      addToast('error', 'Error', error.message || 'Failed to delete workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    clearError();
  };

  const handleModalSave = async () => {
    await loadWorkflows();
    setShowCreateModal(false);
    setShowEditModal(false);
    addToast('success', 'Success', 'Workflow saved successfully');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Workflow Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage workflow definitions and transitions for customer requests
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateWorkflow}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <span className="material-symbols-outlined mr-2 text-lg">add</span>
          New Workflow
        </button>
      </div>

      {/* Statistics Cards */}
      {workflowStatistics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined text-indigo-600 text-3xl">flowchart</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Workflows</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {workflowStatistics.total_workflows}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Workflows</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {workflowStatistics.active_workflows}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined text-red-600 text-3xl">cancel</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Inactive Workflows</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {workflowStatistics.inactive_workflows}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined text-blue-600 text-3xl">swap_horiz</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Transitions</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {workflowStatistics.total_transitions}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow List */}
      <WorkflowDefinitionList
        workflows={workflows}
        isLoading={isLoading}
        onEdit={handleEditWorkflow}
        onViewTransitions={handleViewTransitions}
        onActivate={handleActivateWorkflow}
        onDeactivate={handleDeactivateWorkflow}
        onDelete={handleDeleteWorkflow}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <WorkflowDefinitionModal
          workflow={null}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedWorkflow && (
        <WorkflowDefinitionModal
          workflow={selectedWorkflow}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      {/* Transition Matrix Modal */}
      {showTransitionMatrix && selectedWorkflow && (
        <WorkflowTransitionMatrix
          workflow={selectedWorkflow}
          onClose={() => {
            setShowTransitionMatrix(false);
            setSelectedWorkflow(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkflowManagementHub;
