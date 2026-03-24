import { normalizeText } from './helpers';

export type CreateRequestHandlingMode = 'self_handle' | 'assign_dispatcher';

// XML mapping note:
// Only the first decision node ("Nguoi nhap YC danh gia kha nang tu ho tro, giao viec")
// is represented in the intake form.
// - self_handle      => giao YC cho R
// - assign_dispatcher => giao YC cho PM
// All later decision nodes stay outside create flow and must be handled by
// runtime actions / role-based modals after the request already exists.

export type CustomerRequestCreateFlowDraft = {
  initialEstimatedHours: string;
  estimateNote: string;
  handlingMode: CreateRequestHandlingMode;
  performerUserId: string;
  dispatcherUserId: string;
};

type ResolveCreateRequestPlanOptions = {
  actorUserId?: string | number | null;
};

type CreateEstimatePayload = {
  estimated_hours: number;
  estimate_scope: 'total';
  estimate_type: 'creator_initial';
  note?: string | undefined;
  estimated_by_user_id?: string | undefined;
  sync_master: true;
};

export type CustomerRequestCreatePlan = {
  validationErrors: string[];
  masterOverrides: Record<string, unknown>;
  estimatePayload: CreateEstimatePayload | null;
  transitionPlan: null;
};

export const buildInitialCreateFlowDraft = (
  actorUserId?: string | number | null
): CustomerRequestCreateFlowDraft => {
  const actorId = normalizeText(actorUserId);

  return {
    initialEstimatedHours: '',
    estimateNote: '',
    handlingMode: 'self_handle',
    performerUserId: actorId,
    dispatcherUserId: '',
  };
};

const parsePositiveHours = (value: string): number | null => {
  const normalized = normalizeText(value).replace(',', '.');
  if (normalized === '') {
    return null;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return Number.NaN;
  }

  return Number(numeric.toFixed(2));
};

export const resolveCreateRequestPlan = (
  draft: CustomerRequestCreateFlowDraft,
  options: ResolveCreateRequestPlanOptions = {}
): CustomerRequestCreatePlan => {
  const actorUserId = normalizeText(options.actorUserId);
  const estimateNote = normalizeText(draft.estimateNote);
  const estimatedHours = parsePositiveHours(draft.initialEstimatedHours);
  const validationErrors: string[] = [];
  const masterOverrides: Record<string, unknown> = {};

  if (Number.isNaN(estimatedHours)) {
    validationErrors.push('Estimate ban đầu phải lớn hơn 0 giờ.');
  }

  let estimatePayload: CreateEstimatePayload | null = null;
  if (estimatedHours !== null && !Number.isNaN(estimatedHours)) {
    estimatePayload = {
      estimated_hours: estimatedHours,
      estimate_scope: 'total',
      estimate_type: 'creator_initial',
      note: estimateNote || undefined,
      estimated_by_user_id: actorUserId || undefined,
      sync_master: true,
    };
  }

  if (draft.handlingMode === 'self_handle') {
    const performerUserId = normalizeText(draft.performerUserId) || actorUserId;
    if (performerUserId === '') {
      validationErrors.push('Chọn người xử lý cho nhánh tự xử lý.');
      return {
        validationErrors,
        masterOverrides,
        estimatePayload,
        transitionPlan: null,
      };
    }

    masterOverrides.dispatch_route = 'self_handle';
    masterOverrides.performer_user_id = performerUserId;
    return {
      validationErrors,
      masterOverrides,
      estimatePayload,
      transitionPlan: null,
    };
  }

  const dispatcherUserId = normalizeText(draft.dispatcherUserId);
  if (dispatcherUserId === '') {
    validationErrors.push('Chọn PM điều phối cho nhánh chuyển PM.');
  } else {
    masterOverrides.dispatch_route = 'assign_pm';
    masterOverrides.dispatcher_user_id = dispatcherUserId;
  }

  return {
    validationErrors,
    masterOverrides,
    estimatePayload,
    transitionPlan: null,
  };
};
