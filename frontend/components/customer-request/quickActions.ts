import type { YeuCauProcessMeta } from '../../types';
import { normalizeText } from './helpers';
import {
  PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
  type DispatcherQuickAction,
  type PerformerQuickAction,
} from './presentation';

type BuildQuickActionsOptions = {
  canTransitionActiveRequest: boolean;
  isCreateMode: boolean;
  transitionOptions: YeuCauProcessMeta[];
  currentUserId?: string | number | null;
};

export const buildDispatcherQuickActions = ({
  canTransitionActiveRequest,
  isCreateMode,
  transitionOptions,
  currentUserId,
}: BuildQuickActionsOptions): DispatcherQuickAction[] => {
  if (isCreateMode || !canTransitionActiveRequest) {
    return [];
  }

  const normalizedCurrentUserId = normalizeText(currentUserId);
  const allowedStatuses = new Set(transitionOptions.map((option) => option.process_code));
  const nextActions: DispatcherQuickAction[] = [];

  if (allowedStatuses.has('assigned_to_receiver')) {
    nextActions.push({
      id: 'assign_performer',
      label: 'Giao R thực hiện',
      description: 'Mở form để giao yêu cầu cho R theo đúng bước Workflow A.',
      targetStatusCode: 'assigned_to_receiver',
      icon: 'person_add',
      accentCls: 'border-amber-200 bg-amber-50 hover:border-amber-300',
      payloadOverrides: { to_user_id: '' },
    });

    if (normalizedCurrentUserId !== '') {
      nextActions.push({
        id: 'self_handle',
        label: 'Tự nhận bước giao R',
        description: 'Chuyển nhanh sang bước Giao R thực hiện và mặc định người nhận là chính bạn.',
        targetStatusCode: 'assigned_to_receiver',
        icon: 'build_circle',
        accentCls: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
        payloadOverrides: { to_user_id: normalizedCurrentUserId },
        notePreset: 'Điều phối chọn giao R thực hiện cho chính mình.',
      });
    }
  }

  if (allowedStatuses.has('in_progress') && !allowedStatuses.has('assigned_to_receiver')) {
    nextActions.push({
      id: 'assign_performer',
      label: 'Giao performer',
      description: 'Mở form phân công để chọn người thực hiện, thời gian dự kiến và nội dung xử lý.',
      targetStatusCode: 'in_progress',
      icon: 'person_add',
      accentCls: 'border-amber-200 bg-amber-50 hover:border-amber-300',
      payloadOverrides: { performer_user_id: '' },
    });

    if (normalizedCurrentUserId !== '') {
      nextActions.push({
        id: 'self_handle',
        label: 'Tự xử lý',
        description: 'Chuyển nhanh sang trạng thái đang xử lý và mặc định người thực hiện là chính bạn.',
        targetStatusCode: 'in_progress',
        icon: 'build_circle',
        accentCls: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
        payloadOverrides: { performer_user_id: normalizedCurrentUserId },
        notePreset: 'Điều phối chọn tự xử lý yêu cầu này.',
      });
    }
  }

  if (allowedStatuses.has('analysis')) {
    nextActions.push({
      id: 'analysis',
      label: 'Chuyển phân tích',
      description: 'Mở form phân tích để chỉ định người phân tích và ghi nhận nội dung cần làm rõ.',
      targetStatusCode: 'analysis',
      icon: 'analytics',
      accentCls: 'border-purple-200 bg-purple-50 hover:border-purple-300',
      payloadOverrides: { performer_user_id: '' },
    });
  }

  if (allowedStatuses.has('waiting_customer_feedback')) {
    nextActions.push({
      id: 'request_feedback',
      label: 'Chờ khách hàng',
      description: 'Gửi yêu cầu phản hồi cho khách hàng, ghi rõ nội dung cần phản hồi và hạn phản hồi.',
      targetStatusCode: 'waiting_customer_feedback',
      icon: 'forum',
      accentCls: 'border-yellow-200 bg-yellow-50 hover:border-yellow-300',
    });
  } else if (allowedStatuses.has(PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE)) {
    nextActions.push({
      id: 'review_missing_customer_info',
      label: 'Đánh giá thiếu TT KH',
      description: 'Tách nhánh PM mới theo XML: xác nhận có phải vướng vì khách hàng thiếu thông tin hay không.',
      targetStatusCode: PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
      icon: 'rule',
      accentCls: 'border-rose-200 bg-rose-50 hover:border-rose-300',
    });
  }

  if (allowedStatuses.has('not_executed')) {
    nextActions.push({
      id: 'reject',
      label: 'Từ chối / không thực hiện',
      description: 'Kết thúc yêu cầu ở nhánh không thực hiện và bắt buộc ghi rõ lý do xác nhận.',
      targetStatusCode: 'not_executed',
      icon: 'block',
      accentCls: 'border-slate-300 bg-slate-50 hover:border-slate-400',
    });
  }

  return nextActions;
};

export const buildPerformerQuickActions = ({
  canTransitionActiveRequest,
  isCreateMode,
  transitionOptions,
  currentUserId,
}: BuildQuickActionsOptions): PerformerQuickAction[] => {
  if (isCreateMode || !canTransitionActiveRequest) {
    return [];
  }

  const normalizedCurrentUserId = normalizeText(currentUserId);
  const allowedStatuses = new Set(transitionOptions.map((option) => option.process_code));
  const nextActions: PerformerQuickAction[] = [];

  if (allowedStatuses.has('in_progress')) {
    nextActions.push({
      id: 'take_task',
      label: 'Nhận việc',
      description: 'Nhận yêu cầu về mình, xác nhận ngày bắt đầu và nội dung đang xử lý.',
      targetStatusCode: 'in_progress',
      icon: 'play_arrow',
      accentCls: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
      payloadOverrides: normalizedCurrentUserId !== '' ? { performer_user_id: normalizedCurrentUserId } : undefined,
      notePreset: 'Người thực hiện nhận xử lý yêu cầu này.',
    });
  }

  if (allowedStatuses.has('analysis')) {
    nextActions.push({
      id: 'analysis_task',
      label: 'Chuyển BA Phân tích',
      description: 'Mở form phân tích để ghi rõ hướng xử lý, kết quả rà soát và người chịu trách nhiệm.',
      targetStatusCode: 'analysis',
      icon: 'query_stats',
      accentCls: 'border-violet-200 bg-violet-50 hover:border-violet-300',
      payloadOverrides: normalizedCurrentUserId !== '' ? { performer_user_id: normalizedCurrentUserId } : undefined,
      notePreset: 'Người thực hiện cập nhật nội dung phân tích.',
    });
  }

  if (allowedStatuses.has('analysis_completed')) {
    nextActions.push({
      id: 'complete_task',
      label: 'BA phân tích hoàn thành',
      description: 'Xác nhận bước Chuyển BA Phân tích hoàn thành theo Workflow A.',
      targetStatusCode: 'analysis_completed',
      icon: 'task_alt',
      accentCls: 'border-indigo-200 bg-indigo-50 hover:border-indigo-300',
      notePreset: 'BA cập nhật hoàn thành phân tích.',
    });
  }

  if (allowedStatuses.has('analysis_suspended')) {
    nextActions.push({
      id: 'return_to_manager',
      label: 'BA phân tích tạm ngưng',
      description: 'Chuyển sang trạng thái Chuyển BA Phân tích tạm ngưng.',
      targetStatusCode: 'analysis_suspended',
      icon: 'pause_circle',
      accentCls: 'border-fuchsia-200 bg-fuchsia-50 hover:border-fuchsia-300',
      notePreset: 'BA tạm ngưng xử lý và chờ điều phối.',
    });
  }

  if (allowedStatuses.has('coding_in_progress')) {
    nextActions.push({
      id: 'take_task',
      label: 'Dev đang thực hiện',
      description: 'Chuyển sang trạng thái Dev đang thực hiện.',
      targetStatusCode: 'coding_in_progress',
      icon: 'code',
      accentCls: 'border-violet-200 bg-violet-50 hover:border-violet-300',
      notePreset: 'Dev bắt đầu thực hiện.',
    });
  }

  if (allowedStatuses.has('coding_suspended')) {
    nextActions.push({
      id: 'return_to_manager',
      label: 'Dev tạm ngưng',
      description: 'Chuyển sang trạng thái Dev tạm ngưng.',
      targetStatusCode: 'coding_suspended',
      icon: 'pause_circle',
      accentCls: 'border-fuchsia-200 bg-fuchsia-50 hover:border-fuchsia-300',
      notePreset: 'Dev tạm ngưng xử lý.',
    });
  }

  if (allowedStatuses.has('dms_task_created')) {
    nextActions.push({
      id: 'analysis_task',
      label: 'Tạo task DMS',
      description: 'Chuyển sang trạng thái Tạo task.',
      targetStatusCode: 'dms_task_created',
      icon: 'add_task',
      accentCls: 'border-lime-200 bg-lime-50 hover:border-lime-300',
      notePreset: 'Tạo task DMS theo workflow.',
    });
  }

  if (allowedStatuses.has('dms_in_progress')) {
    nextActions.push({
      id: 'take_task',
      label: 'DMS Đang thực hiện',
      description: 'Chuyển sang trạng thái DMS Đang thực hiện.',
      targetStatusCode: 'dms_in_progress',
      icon: 'sync',
      accentCls: 'border-lime-200 bg-lime-50 hover:border-lime-300',
      notePreset: 'DMS bắt đầu xử lý.',
    });
  }

  if (allowedStatuses.has('dms_suspended')) {
    nextActions.push({
      id: 'return_to_manager',
      label: 'DMS tạm ngưng',
      description: 'Chuyển sang trạng thái DMS tạm ngưng.',
      targetStatusCode: 'dms_suspended',
      icon: 'pause_circle',
      accentCls: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
      notePreset: 'DMS tạm ngưng xử lý.',
    });
  }

  if (allowedStatuses.has('completed') && !allowedStatuses.has('analysis_completed')) {
    nextActions.push({
      id: 'complete_task',
      label: 'Hoàn thành',
      description: 'Chốt kết quả thực hiện, xác nhận thời điểm hoàn thành và chuyển sang bước hoàn tất.',
      targetStatusCode: 'completed',
      icon: 'task_alt',
      accentCls: 'border-teal-200 bg-teal-50 hover:border-teal-300',
      payloadOverrides: normalizedCurrentUserId !== '' ? { completed_by_user_id: normalizedCurrentUserId } : undefined,
      notePreset: 'Người thực hiện xác nhận đã hoàn thành yêu cầu.',
    });
  }

  if (allowedStatuses.has('returned_to_manager') && !allowedStatuses.has('analysis_suspended') && !allowedStatuses.has('coding_suspended') && !allowedStatuses.has('dms_suspended')) {
    nextActions.push({
      id: 'return_to_manager',
      label: 'Trả người quản lý',
      description: 'Chuyển trả để xin hướng dẫn thêm, đổi phân công hoặc nêu rõ vướng mắc hiện tại.',
      targetStatusCode: 'returned_to_manager',
      icon: 'assignment_return',
      accentCls: 'border-orange-200 bg-orange-50 hover:border-orange-300',
      payloadOverrides: normalizedCurrentUserId !== '' ? { returned_by_user_id: normalizedCurrentUserId } : undefined,
      notePreset: 'Người thực hiện chuyển trả yêu cầu cho quản lý.',
    });
  }

  if (allowedStatuses.has('customer_notified')) {
    nextActions.push({
      id: 'notify_customer',
      label: 'Báo khách hàng',
      description: 'Ghi nhận nội dung phản hồi đã gửi cho khách hàng và kênh liên lạc sử dụng.',
      targetStatusCode: 'customer_notified',
      icon: 'campaign',
      accentCls: 'border-cyan-200 bg-cyan-50 hover:border-cyan-300',
      payloadOverrides: normalizedCurrentUserId !== '' ? { notified_by_user_id: normalizedCurrentUserId } : undefined,
      notePreset: 'Người thực hiện cập nhật việc báo khách hàng.',
    });
  }

  return nextActions;
};
