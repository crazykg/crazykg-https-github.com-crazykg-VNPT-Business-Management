import { describe, expect, it } from 'vitest';
import type { YeuCauProcessMeta } from '../types';
import {
  buildDispatcherQuickActions,
  buildPerformerQuickActions,
} from '../components/customer-request/quickActions';
import { PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE } from '../components/customer-request/presentation';

const makeProcess = (processCode: string): YeuCauProcessMeta => ({
  process_code: processCode,
  process_label: processCode,
  group_code: 'grp',
  group_label: 'Group',
  table_name: `customer_request_${processCode}`,
  default_status: processCode,
  read_roles: [],
  write_roles: [],
  allowed_next_processes: [],
  form_fields: [],
  list_columns: [],
});

describe('customer request quick actions', () => {
  it('builds dispatcher quick actions from allowed transitions', () => {
    const actions = buildDispatcherQuickActions({
      canTransitionActiveRequest: true,
      isCreateMode: false,
      transitionOptions: [
        makeProcess('in_progress'),
        makeProcess('analysis'),
        makeProcess('waiting_customer_feedback'),
        makeProcess('not_executed'),
      ],
      currentUserId: 25,
    });

    expect(actions.map((action) => action.id)).toEqual([
      'assign_performer',
      'self_handle',
      'analysis',
      'request_feedback',
      'reject',
    ]);
    expect(actions.find((action) => action.id === 'self_handle')?.payloadOverrides).toEqual({
      performer_user_id: '25',
    });
    expect(actions.find((action) => action.id === 'assign_performer')?.payloadOverrides).toEqual({
      performer_user_id: '',
    });
  });

  it('collapses PM missing-customer-info outcomes into one dispatcher action', () => {
    const actions = buildDispatcherQuickActions({
      canTransitionActiveRequest: true,
      isCreateMode: false,
      transitionOptions: [
        makeProcess('in_progress'),
        makeProcess('analysis'),
        makeProcess(PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE),
      ],
      currentUserId: 25,
    });

    expect(actions.map((action) => action.id)).toEqual([
      'assign_performer',
      'self_handle',
      'analysis',
      'review_missing_customer_info',
    ]);
    expect(actions.find((action) => action.id === 'review_missing_customer_info')?.targetStatusCode).toBe(
      PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE
    );
  });

  it('builds performer quick actions with actor-aware defaults', () => {
    const actions = buildPerformerQuickActions({
      canTransitionActiveRequest: true,
      isCreateMode: false,
      transitionOptions: [
        makeProcess('in_progress'),
        makeProcess('analysis'),
        makeProcess('completed'),
        makeProcess('returned_to_manager'),
        makeProcess('customer_notified'),
      ],
      currentUserId: '88',
    });

    expect(actions.map((action) => action.id)).toEqual([
      'take_task',
      'analysis_task',
      'complete_task',
      'return_to_manager',
      'notify_customer',
    ]);
    expect(actions.find((action) => action.id === 'take_task')?.payloadOverrides).toEqual({
      performer_user_id: '88',
    });
    expect(actions.find((action) => action.id === 'complete_task')?.payloadOverrides).toEqual({
      completed_by_user_id: '88',
    });
    expect(actions.find((action) => action.id === 'return_to_manager')?.payloadOverrides).toEqual({
      returned_by_user_id: '88',
    });
  });

  it('returns no quick actions when transitions are disabled or in create mode', () => {
    expect(
      buildDispatcherQuickActions({
        canTransitionActiveRequest: false,
        isCreateMode: false,
        transitionOptions: [makeProcess('in_progress')],
        currentUserId: 1,
      })
    ).toEqual([]);

    expect(
      buildPerformerQuickActions({
        canTransitionActiveRequest: true,
        isCreateMode: true,
        transitionOptions: [makeProcess('completed')],
        currentUserId: 1,
      })
    ).toEqual([]);
  });
});
