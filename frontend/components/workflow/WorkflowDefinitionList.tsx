import React from 'react';
import { WorkflowDefinition } from '../../shared/stores/workflowStore';

interface WorkflowDefinitionListProps {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  onEdit: (workflow: WorkflowDefinition) => void;
  onViewTransitions: (workflow: WorkflowDefinition) => void;
  onActivate: (workflow: WorkflowDefinition) => void;
  onDeactivate: (workflow: WorkflowDefinition) => void;
  onDelete: (id: number, code: string) => void;
}

const WorkflowDefinitionList: React.FC<WorkflowDefinitionListProps> = ({
  workflows,
  isLoading,
  onEdit,
  onViewTransitions,
  onActivate,
  onDeactivate,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6 text-center">
        <span className="material-symbols-outlined text-gray-400 text-6xl">flowchart</span>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No workflows found</h3>
        <p className="mt-2 text-sm text-gray-500">
          Get started by creating a new workflow definition.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Workflow Definitions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Process Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Version
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activated At
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workflows.map((workflow) => (
              <tr key={workflow.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{workflow.code}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{workflow.name}</div>
                  {workflow.description && (
                    <div className="text-sm text-gray-500 truncate max-w-xs">{workflow.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {workflow.process_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {workflow.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <span className="material-symbols-outlined text-xs mr-1">check_circle</span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <span className="material-symbols-outlined text-xs mr-1">cancel</span>
                        Inactive
                      </span>
                    )}
                    {workflow.is_default && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Default
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {workflow.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {workflow.activated_at ? new Date(workflow.activated_at).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => onViewTransitions(workflow)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="View Transitions"
                    >
                      <span className="material-symbols-outlined text-lg">swap_horiz</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(workflow)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(workflow.id, workflow.code)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkflowDefinitionList;
