import { describe, expect, it } from 'vitest';
import {
  buildInitialCreateFlowDraft,
  resolveCreateRequestPlan,
} from '../components/customer-request/createFlow';

describe('customer request create flow', () => {
  it('defaults create draft to self handle by current user', () => {
    expect(buildInitialCreateFlowDraft(25)).toEqual({
      initialEstimatedHours: '',
      estimateNote: '',
      handlingMode: 'self_handle',
      performerUserId: '25',
      dispatcherUserId: '',
    });
  });

  it('builds estimate and transition plan for self handle flow', () => {
    const plan = resolveCreateRequestPlan(
      {
        initialEstimatedHours: '6.5',
        estimateNote: 'Khởi tạo estimate ban đầu',
        handlingMode: 'self_handle',
        performerUserId: '88',
        dispatcherUserId: '',
      },
      { actorUserId: 12 }
    );

    expect(plan.validationErrors).toEqual([]);
    expect(plan.masterOverrides).toEqual({
      performer_user_id: '88',
    });
    expect(plan.estimatePayload).toEqual({
      estimated_hours: 6.5,
      estimate_scope: 'total',
      estimate_type: 'creator_initial',
      note: 'Khởi tạo estimate ban đầu',
      estimated_by_user_id: '12',
      sync_master: true,
    });
    expect(plan.transitionPlan).toEqual({
      toStatusCode: 'in_progress',
      statusPayload: {
        performer_user_id: '88',
      },
    });
  });

  it('requires dispatcher for assign dispatcher flow and rejects invalid estimate', () => {
    const plan = resolveCreateRequestPlan(
      {
        initialEstimatedHours: '0',
        estimateNote: '',
        handlingMode: 'assign_dispatcher',
        performerUserId: '',
        dispatcherUserId: '',
      },
      { actorUserId: 15 }
    );

    expect(plan.validationErrors).toEqual([
      'Estimate ban đầu phải lớn hơn 0 giờ.',
      'Chọn PM điều phối cho nhánh chuyển PM.',
    ]);
    expect(plan.masterOverrides).toEqual({});
    expect(plan.estimatePayload).toBeNull();
    expect(plan.transitionPlan).toBeNull();
  });
});
