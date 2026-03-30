import React, { useEffect, useMemo, useState } from 'react';
import { WorkflowDefinition, WorkflowTransition } from '../../shared/stores/workflowStore';
import { useWorkflowStore } from '../../shared/stores/workflowStore';
import { getTransitions, deleteTransition, updateTransition } from '../../services/workflowApi';
import { useToastStore } from '../../shared/stores/toastStore';

const ROLE_OPTIONS = ['all', 'R', 'A', 'C', 'I'] as const;

interface TransitionEditDraft {
  from_status_code: string;
  to_status_code: string;
  allowed_roles: string[];
  required_fields: string;
  is_active: boolean;
}

interface WorkflowTransitionMatrixProps {
  workflow: WorkflowDefinition;
  onClose: () => void;
}

const WorkflowTransitionMatrix: React.FC<WorkflowTransitionMatrixProps> = ({
  workflow,
  onClose,
}) => {
  const { addToast } = useToastStore();
  const { setTransitions, transitions, setSaving, setLoading } = useWorkflowStore();
  const [isLoading, setIsLoading] = useState(true);
  const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null);
  const [editDraft, setEditDraft] = useState<TransitionEditDraft | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);

  const statusCodeOptions = useMemo(() => {
    const values = new Set<string>();
    transitions.forEach((transition) => {
      if (transition.from_status_code) {
        values.add(transition.from_status_code);
      }
      if (transition.to_status_code) {
        values.add(transition.to_status_code);
      }
    });
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [transitions]);

  const openEditModal = (transition: WorkflowTransition) => {
    setEditingTransition(transition);
    setEditDraft({
      from_status_code: transition.from_status_code,
      to_status_code: transition.to_status_code,
      allowed_roles: [...(transition.allowed_roles || [])],
      required_fields: (transition.required_fields || []).join(', '),
      is_active: Boolean(transition.is_active),
    });
  };

  const closeEditModal = () => {
    if (isEditSaving) {
      return;
    }
    setEditingTransition(null);
    setEditDraft(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTransition || !editDraft) {
      return;
    }

    const allowedRoles = Array.from(new Set(editDraft.allowed_roles.filter(Boolean)));
    if (!editDraft.from_status_code.trim() || !editDraft.to_status_code.trim()) {
      addToast('error', 'Error', 'From status và To status là bắt buộc');
      return;
    }
    if (allowedRoles.length === 0) {
      addToast('error', 'Error', 'Phải chọn ít nhất một allowed role');
      return;
    }

    const requiredFields = editDraft.required_fields
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      setIsEditSaving(true);
      await updateTransition(editingTransition.id, {
        from_status_code: editDraft.from_status_code.trim(),
        to_status_code: editDraft.to_status_code.trim(),
        allowed_roles: allowedRoles,
        required_fields: requiredFields,
        is_active: editDraft.is_active,
      });
      await loadTransitions();
      closeEditModal();
      addToast('success', 'Success', 'Transition updated successfully');
    } catch (error: any) {
      addToast('error', 'Error', error?.message || 'Failed to update transition');
    } finally {
      setSaving(false);
      setIsEditSaving(false);
    }
  };

  useEffect(() => {
    loadTransitions();
  }, [workflow.id]);

  const loadTransitions = async () => {
    try {
      setLoading(true);
      setIsLoading(true);
      const res = await getTransitions(workflow.id, false);
      setTransitions(res.data || []);
    } catch (error: any) {
      addToast('error', 'Error', 'Failed to load transitions');
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transition?')) {
      return;
    }

    try {
      setSaving(true);
      await deleteTransition(id);
      await loadTransitions();
      addToast('success', 'Success', 'Transition deleted successfully');
    } catch (error: any) {
      addToast('error', 'Error', 'Failed to delete transition');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (roles: string[]) => {
    if (roles.includes('all')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (roles.includes('R')) {
      return 'bg-green-100 text-green-800';
    }
    if (roles.includes('A')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        {/* Modal panel - Full screen */}
        <div className="inline-block w-full max-w-6xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Transition Matrix - {workflow.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Code: {workflow.code} | Total Transitions: {transitions.length}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Transitions Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From Status Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From Status Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To Status Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To Status Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allowed Roles
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required Fields
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transitions.map((transition, index) => (
                  <tr key={transition.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transition.from_status_name || transition.from_status_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {transition.from_status_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transition.to_status_name || transition.to_status_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {transition.to_status_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        {transition.allowed_roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(
                              transition.allowed_roles
                            )}`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {transition.required_fields?.length > 0
                          ? transition.required_fields.join(', ')
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {transition.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(transition)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(transition.id)}
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

          {/* Footer */}
          <div className="mt-6 flex justify-between items-center pt-6 border-t">
            <div className="text-sm text-gray-500">
              Showing {transitions.length} transitions
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {editingTransition && editDraft ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Edit Transition</h4>
                <p className="mt-1 text-sm text-gray-500">{workflow.name}</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={isEditSaving}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">From Status Code</span>
                <input
                  list="workflow-transition-status-codes"
                  value={editDraft.from_status_code}
                  onChange={(event) => setEditDraft((prev) => prev ? { ...prev, from_status_code: event.target.value } : prev)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">To Status Code</span>
                <input
                  list="workflow-transition-status-codes"
                  value={editDraft.to_status_code}
                  onChange={(event) => setEditDraft((prev) => prev ? { ...prev, to_status_code: event.target.value } : prev)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </label>

              <div className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-gray-700">Allowed Roles</span>
                <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 p-3">
                  {ROLE_OPTIONS.map((role) => {
                    const checked = editDraft.allowed_roles.includes(role);
                    return (
                      <label key={role} className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setEditDraft((prev) => {
                              if (!prev) return prev;
                              const nextRoles = event.target.checked
                                ? [...prev.allowed_roles, role]
                                : prev.allowed_roles.filter((item) => item !== role);
                              return { ...prev, allowed_roles: Array.from(new Set(nextRoles)) };
                            });
                          }}
                        />
                        {role}
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Required Fields</span>
                <input
                  value={editDraft.required_fields}
                  onChange={(event) => setEditDraft((prev) => prev ? { ...prev, required_fields: event.target.value } : prev)}
                  placeholder="vd: receiver_user_id, accepted_at"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={editDraft.is_active}
                  onChange={(event) => setEditDraft((prev) => prev ? { ...prev, is_active: event.target.checked } : prev)}
                />
                Active
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isEditSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isEditSaving}
              >
                {isEditSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <datalist id="workflow-transition-status-codes">
        {statusCodeOptions.map((statusCode) => (
          <option key={statusCode} value={statusCode} />
        ))}
      </datalist>
    </div>
  );
};

export default WorkflowTransitionMatrix;
