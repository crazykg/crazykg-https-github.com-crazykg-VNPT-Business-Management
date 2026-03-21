import type { YeuCauProcessMeta } from '../../types';
import { normalizeText } from './helpers';
import type { DispatcherQuickAction, PerformerQuickAction } from './presentation';

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

  if (allowedStatuses.has('in_progress')) {
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
      label: 'Ghi nhận phân tích',
      description: 'Mở form phân tích để ghi rõ hướng xử lý, kết quả rà soát và người chịu trách nhiệm.',
      targetStatusCode: 'analysis',
      icon: 'query_stats',
      accentCls: 'border-violet-200 bg-violet-50 hover:border-violet-300',
      payloadOverrides: normalizedCurrentUserId !== '' ? { performer_user_id: normalizedCurrentUserId } : undefined,
      notePreset: 'Người thực hiện cập nhật nội dung phân tích.',
    });
  }

  if (allowedStatuses.has('completed')) {
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

  if (allowedStatuses.has('returned_to_manager')) {
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
