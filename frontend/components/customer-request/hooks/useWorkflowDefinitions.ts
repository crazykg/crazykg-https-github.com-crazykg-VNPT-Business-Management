import { useEffect, useState } from 'react';
import {
  fetchWorkflowDefinitions,
  fetchDefaultWorkflowDefinition,
  isRequestCanceledError,
} from '../../../services/api/customerRequestApi';
import type { WorkflowDefinition } from '../../../services/api/customerRequestApi';

type UseWorkflowDefinitionsOptions = {
  enabled?: boolean;
  processType?: string;
};

export const useWorkflowDefinitions = ({
  enabled = true,
  processType = 'customer_request',
}: UseWorkflowDefinitionsOptions = {}) => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [defaultWorkflowId, setDefaultWorkflowId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const loadWorkflows = async () => {
      try {
        const [workflowsResult, defaultResult] = await Promise.allSettled([
          fetchWorkflowDefinitions(processType),
          fetchDefaultWorkflowDefinition(processType),
        ]);

        if (cancelled) {
          return;
        }

        if (workflowsResult.status === 'fulfilled') {
          setWorkflows(workflowsResult.value);
        } else {
          throw workflowsResult.reason;
        }

        if (defaultResult.status === 'fulfilled' && defaultResult.value) {
          setDefaultWorkflowId(defaultResult.value.id);
        } else if (workflowsResult.value.length > 0) {
          // Fallback: use first active workflow as default
          const activeWorkflow = workflowsResult.value.find(w => w.is_active);
          setDefaultWorkflowId(activeWorkflow?.id ?? workflowsResult.value[0]?.id ?? null);
        }
      } catch (err) {
        if (cancelled || isRequestCanceledError(err)) {
          return;
        }
        setError(err instanceof Error ? err : new Error('Failed to load workflows'));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadWorkflows();

    return () => {
      cancelled = true;
    };
  }, [enabled, processType]);

  return {
    workflows,
    defaultWorkflowId,
    isLoading,
    error,
  };
};
