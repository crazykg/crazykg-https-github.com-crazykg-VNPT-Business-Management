import type {
  YeuCauProcessCatalog,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauRefTaskRow,
} from '../../types/customerRequest';
import type { SupportRequestTaskStatus } from '../../types/support';
import type { CustomerRequestTaskSource, It360TaskFormRow, ReferenceTaskFormRow } from './presentation';

export type DraftState = Record<string, unknown>;

export const normalizeText = (value: unknown): string => String(value ?? '').trim();

export const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

export const buildTaskRowId = (): string => `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeSupportTaskStatus = (value: unknown): SupportRequestTaskStatus => {
  const token = normalizeToken(value);
  if (token === 'INPROGRESS' || token === 'DANGTHUCHIEN') {
    return 'IN_PROGRESS';
  }
  if (token === 'DONE' || token === 'HOANTHANH' || token === 'DAHOANTHANH') {
    return 'DONE';
  }
  if (token === 'CANCELLED' || token === 'HUY') {
    return 'CANCELLED';
  }
  if (token === 'BLOCKED' || token === 'CHUYENSANGTASKKHAC') {
    return 'BLOCKED';
  }

  return 'TODO';
};

export const normalizeCustomerRequestTaskSource = (
  value: unknown,
  fallback: CustomerRequestTaskSource = 'IT360'
): CustomerRequestTaskSource => {
  const token = normalizeToken(value);
  if (token === 'REFERENCE' || token === 'THAMCHIEU' || token === 'REFERENCETASK') {
    return 'REFERENCE';
  }
  if (token === 'IT360') {
    return 'IT360';
  }

  return fallback;
};

export const createEmptyIt360TaskRow = (partial?: Partial<It360TaskFormRow>): It360TaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  id: partial?.id ?? null,
  task_code: partial?.task_code || '',
  task_link: partial?.task_link || '',
  status: normalizeSupportTaskStatus(partial?.status || 'TODO'),
});

export const createEmptyReferenceTaskRow = (partial?: Partial<ReferenceTaskFormRow>): ReferenceTaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  id: partial?.id ?? null,
  task_code: partial?.task_code || '',
});

export const formatCurrentDateTimeForInput = (): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const formatCurrentDateForInput = (): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatCurrentDateStartOfDayForInput = (): string =>
  `${formatCurrentDateForInput()}T00:00`;

export const DATE_ONLY_TRANSITION_FIELD_NAMES = new Set([
  'feedback_requested_at',
  'customer_due_at',
  'customer_feedback_at',
]);

export const EMPTY_DEFAULT_DATE_TRANSITION_FIELD_NAMES = new Set([
  'customer_due_at',
  'customer_feedback_at',
]);

export const isDateOnlyTransitionField = (fieldName: string): boolean =>
  DATE_ONLY_TRANSITION_FIELD_NAMES.has(normalizeText(fieldName));

export const READONLY_DATETIME_TRANSITION_FIELD_NAMES = new Set([
  'started_at',
  'expected_completed_at',
]);

export const isReadonlyDateTimeTransitionField = (fieldName: string): boolean =>
  READONLY_DATETIME_TRANSITION_FIELD_NAMES.has(normalizeText(fieldName));

export const toTimeInput = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '00:00';
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized.slice(11, 16);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    return normalized.slice(11, 16);
  }

  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return '00:00';
};

export const combineDateWithExistingTime = (
  dateValue: unknown,
  currentValue: unknown
): string => {
  const normalizedDate = normalizeText(dateValue);
  if (!normalizedDate) {
    return '';
  }

  return `${normalizedDate}T${toTimeInput(currentValue)}`;
};

export const toDateTimeLocal = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized.replace(' ', 'T').slice(0, 16);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    return normalized.slice(0, 16);
  }

  return normalized;
};

export const toDateInput = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized.slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    return normalized.slice(0, 10);
  }

  return normalized;
};

export const toSqlDateTime = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized} 00:00:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace('T', ' ')}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return normalized;
};

export const findProcessByCode = (
  catalog: YeuCauProcessCatalog | null,
  processCode: string | null | undefined
): YeuCauProcessMeta | null => {
  const target = normalizeText(processCode);
  if (!catalog || !target) {
    return null;
  }

  for (const group of catalog.groups) {
    const match = group.processes.find((process) => process.process_code === target);
    if (match) {
      return match;
    }
  }

  return null;
};

export const buildDraftFromFields = (
  fields: YeuCauProcessField[],
  source: Record<string, unknown> | null | undefined
): DraftState => {
  const nextDraft: DraftState = {};
  for (const field of fields) {
    const rawValue = source?.[field.name];
    if (field.type === 'datetime') {
      nextDraft[field.name] = isDateOnlyTransitionField(field.name) ? toDateInput(rawValue) : toDateTimeLocal(rawValue);
      continue;
    }
    if (field.type === 'boolean_nullable') {
      if (rawValue === true || rawValue === 1 || rawValue === '1') {
        nextDraft[field.name] = '1';
      } else if (rawValue === false || rawValue === 0 || rawValue === '0') {
        nextDraft[field.name] = '0';
      } else {
        nextDraft[field.name] = '';
      }
      continue;
    }
    if (field.type === 'json_textarea' && rawValue && typeof rawValue !== 'string') {
      nextDraft[field.name] = JSON.stringify(rawValue, null, 2);
      continue;
    }
    nextDraft[field.name] = rawValue ?? '';
  }

  return nextDraft;
};

export const serializeDraftValue = (field: YeuCauProcessField, value: unknown): unknown => {
  if (field.type === 'datetime') {
    return toSqlDateTime(value);
  }
  if (field.type === 'boolean_nullable') {
    const normalized = normalizeText(value);
    if (!normalized) {
      return null;
    }
    return normalized === '1';
  }
  if (
    field.type === 'number'
    || field.type === 'priority'
    || field.type === 'user_select'
    || field.type === 'customer_select'
  ) {
    const normalized = normalizeText(value);
    return normalized ? normalized : null;
  }

  const normalized = normalizeText(value);
  return normalized ? normalized : null;
};

export const buildPayloadFromDraft = (
  fields: YeuCauProcessField[],
  draft: DraftState
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    payload[field.name] = serializeDraftValue(field, draft[field.name]);
  }
  return payload;
};

export const buildTransitionDraftFromFields = (
  fields: YeuCauProcessField[],
  options: {
    actorUserId?: string | number | null;
    defaultHandlerUserId?: string | number | null;
    currentPerformerUserId?: string | number | null;
  }
): DraftState => {
  const draft = buildDraftFromFields(fields, null);
  const currentDateTime = formatCurrentDateTimeForInput();
  const currentDate = formatCurrentDateForInput();
  const actorUserId = normalizeText(options.actorUserId);
  const defaultHandlerUserId = normalizeText(options.defaultHandlerUserId);
  const currentPerformerUserId = normalizeText(options.currentPerformerUserId);

  fields.forEach((field) => {
    if (field.type === 'datetime' && normalizeText(draft[field.name]) === '') {
      if (isDateOnlyTransitionField(field.name)) {
        if (!EMPTY_DEFAULT_DATE_TRANSITION_FIELD_NAMES.has(normalizeText(field.name))) {
          draft[field.name] = currentDate;
        }
      } else {
        draft[field.name] = currentDateTime;
      }
      return;
    }

    if (field.type === 'number' && field.name === 'progress_percent' && normalizeText(draft[field.name]) === '') {
      draft[field.name] = '0';
      return;
    }

    if (field.type !== 'user_select' || normalizeText(draft[field.name]) !== '') {
      return;
    }

    let preferredUserId = '';
    if (field.name === 'performer_user_id') {
      preferredUserId = currentPerformerUserId || defaultHandlerUserId || actorUserId;
    } else if (field.name === 'notified_by_user_id') {
      preferredUserId = defaultHandlerUserId || actorUserId;
    } else if (
      field.name === 'decision_by_user_id'
      || field.name === 'completed_by_user_id'
      || field.name === 'returned_by_user_id'
    ) {
      preferredUserId = actorUserId || defaultHandlerUserId;
    }

    if (preferredUserId !== '') {
      draft[field.name] = preferredUserId;
    }
  });

  return draft;
};

export const buildIt360TaskSignature = (task: It360TaskFormRow): string =>
  [normalizeToken(task.task_code), normalizeText(task.task_link), normalizeSupportTaskStatus(task.status)].join('|');

export const dedupeIt360TaskRows = (rows: It360TaskFormRow[]): It360TaskFormRow[] => {
  const seen = new Set<string>();
  const deduped: It360TaskFormRow[] = [];
  rows.forEach((task) => {
    const signature = buildIt360TaskSignature(task);
    if (signature === '' || seen.has(signature)) {
      return;
    }
    seen.add(signature);
    deduped.push(task);
  });
  return deduped;
};

export const dedupeReferenceTaskRows = (rows: ReferenceTaskFormRow[]): ReferenceTaskFormRow[] => {
  const seen = new Set<string>();
  const deduped: ReferenceTaskFormRow[] = [];
  rows.forEach((task) => {
    const signature = normalizeToken(task.task_code);
    if (signature === '' || seen.has(signature)) {
      return;
    }
    seen.add(signature);
    deduped.push(task);
  });
  return deduped;
};

export const splitCustomerRequestTaskRows = (
  rows: YeuCauRefTaskRow[]
): { it360Rows: It360TaskFormRow[]; referenceRows: ReferenceTaskFormRow[] } => {
  const it360Rows: It360TaskFormRow[] = [];
  const referenceRows: ReferenceTaskFormRow[] = [];

  rows.forEach((task) => {
    const source = normalizeCustomerRequestTaskSource(task.task_source, 'REFERENCE');
    const taskCode = normalizeText(task.task_code ?? task.request_code);
    const taskLink = normalizeText(task.task_link);
    // Ưu tiên ref_task_id (id của request_ref_tasks) thay vì id (pivot id của customer_request_status_ref_tasks)
    const taskId = task.ref_task_id ?? task.id ?? null;
    const id = typeof taskId === 'string' || typeof taskId === 'number' ? taskId : null;

    if (source === 'REFERENCE') {
      if (taskCode !== '') {
        referenceRows.push(createEmptyReferenceTaskRow({ id, task_code: taskCode }));
      }
      return;
    }

    if (taskCode === '' && taskLink === '') {
      return;
    }

    it360Rows.push(
      createEmptyIt360TaskRow({
        id,
        task_code: taskCode,
        task_link: taskLink,
        status: normalizeSupportTaskStatus(task.task_status ?? 'TODO'),
      })
    );
  });

  return {
    it360Rows: dedupeIt360TaskRows(it360Rows),
    referenceRows: dedupeReferenceTaskRows(referenceRows),
  };
};
