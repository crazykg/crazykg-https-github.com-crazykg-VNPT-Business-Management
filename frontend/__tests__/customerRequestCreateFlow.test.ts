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

  it('maps self handle only to the first XML diamond and keeps later decisions outside create flow', () => {
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
      dispatch_route: 'self_handle',
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
    expect(plan.transitionPlan).toBeNull();
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

  it('keeps assign dispatcher as create-only routing without forcing a follow-up status transition', () => {
    const plan = resolveCreateRequestPlan(
      {
        initialEstimatedHours: '4',
        estimateNote: 'Creator đánh giá sơ bộ',
        handlingMode: 'assign_dispatcher',
        performerUserId: '88',
        dispatcherUserId: '21',
      },
      { actorUserId: 15 }
    );

    expect(plan.validationErrors).toEqual([]);
    expect(plan.masterOverrides).toEqual({
      dispatch_route: 'assign_pm',
      dispatcher_user_id: '21',
    });
    expect(plan.estimatePayload).toEqual({
      estimated_hours: 4,
      estimate_scope: 'total',
      estimate_type: 'creator_initial',
      note: 'Creator đánh giá sơ bộ',
      estimated_by_user_id: '15',
      sync_master: true,
    });
    expect(plan.transitionPlan).toBeNull();
  });
});
