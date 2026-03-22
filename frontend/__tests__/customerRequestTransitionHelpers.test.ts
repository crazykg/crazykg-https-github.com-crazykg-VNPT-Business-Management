import { describe, expect, it } from 'vitest';
import {
  buildTransitionDraftFromFields,
  toDateInput,
  toSqlDateTime,
} from '../components/customer-request/helpers';
import type { YeuCauProcessField } from '../types';

describe('customer request transition helpers', () => {
  it('keeps feedback date fields date-only and leaves customer dates blank by default', () => {
    const fields: YeuCauProcessField[] = [
      { name: 'feedback_requested_at', label: 'Ngày gửi phản hồi', type: 'datetime' },
      { name: 'customer_due_at', label: 'Hạn phản hồi', type: 'datetime' },
      { name: 'customer_feedback_at', label: 'Ngày khách hàng phản hồi', type: 'datetime' },
    ];

    const draft = buildTransitionDraftFromFields(fields, {});

    expect(draft.feedback_requested_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.customer_due_at).toBe('');
    expect(draft.customer_feedback_at).toBe('');
  });

  it('normalizes stored datetime values to date inputs and serializes back to sql midnight', () => {
    expect(toDateInput('2026-03-22 21:15:00')).toBe('2026-03-22');
    expect(toDateInput('2026-03-22T21:15')).toBe('2026-03-22');
    expect(toSqlDateTime('2026-03-22')).toBe('2026-03-22 00:00:00');
  });
});
