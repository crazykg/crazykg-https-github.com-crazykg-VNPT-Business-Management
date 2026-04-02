import React, { useState } from 'react';
import { WorkflowDefinition } from '../../shared/stores/workflowStore';
import { useWorkflowStore } from '../../shared/stores/workflowStore';
import { createWorkflow, updateWorkflow } from '../../services/workflowApi';

interface WorkflowDefinitionModalProps {
  workflow: WorkflowDefinition | null;
  onClose: () => void;
  onSave: () => void;
}

const WorkflowDefinitionModal: React.FC<WorkflowDefinitionModalProps> = ({
  workflow,
  onClose,
  onSave,
}) => {
  const { isSaving, setSaving, setError, clearError } = useWorkflowStore();
  
  const [formData, setFormData] = useState<Partial<WorkflowDefinition>>({
    code: workflow?.code || '',
    name: workflow?.name || '',
    description: workflow?.description || '',
    process_type: workflow?.process_type || 'customer_request',
    is_active: workflow?.is_active ?? true,
    is_default: workflow?.is_default ?? false,
    version: workflow?.version || '1.0',
    config: workflow?.config || {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.code?.trim()) {
      newErrors.code = 'Code is required';
    }
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.process_type?.trim()) {
      newErrors.process_type = 'Process type is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      clearError();

      if (workflow) {
        await updateWorkflow(workflow.id, formData);
      } else {
        await createWorkflow(formData);
      }

      onSave();
    } catch (error: any) {
      console.error('❌ Workflow save error:', error);
      setError(error.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof WorkflowDefinition, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        {/* Modal panel */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {workflow ? 'Edit Workflow' : 'Create New Workflow'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="code"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                disabled={!!workflow}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  errors.code ? 'border-red-500' : ''
                } ${workflow ? 'bg-gray-100' : ''}`}
                placeholder="e.g., LUONG_A"
              />
              {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  errors.name ? 'border-red-500' : ''
                }`}
                placeholder="e.g., Luồng xử lý A"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Workflow description..."
              />
            </div>

            {/* Process Type */}
            <div>
              <label htmlFor="process_type" className="block text-sm font-medium text-gray-700">
                Process Type <span className="text-red-500">*</span>
              </label>
              <select
                id="process_type"
                value={formData.process_type}
                onChange={(e) => handleChange('process_type', e.target.value)}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  errors.process_type ? 'border-red-500' : ''
                }`}
              >
                <option value="customer_request">Customer Request</option>
                <option value="project_procedure">Project Procedure</option>
              </select>
              {errors.process_type && <p className="mt-1 text-sm text-red-600">{errors.process_type}</p>}
            </div>

            {/* Version */}
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700">
                Version
              </label>
              <input
                type="text"
                id="version"
                value={formData.version}
                onChange={(e) => handleChange('version', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="1.0"
              />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => handleChange('is_default', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
                  Default
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : workflow ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDefinitionModal;
