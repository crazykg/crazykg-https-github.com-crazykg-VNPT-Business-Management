// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomerRequestTransition } from '../components/customer-request/hooks/useCustomerRequestTransition';
import type { YeuCauProcessDetail } from '../types/customerRequest';

const mockFetchYeuCauTimeline = vi.fn();

vi.mock('../services/v5Api', () => ({
  fetchYeuCauTimeline: (...args: unknown[]) => mockFetchYeuCauTimeline(...args),
  transitionCustomerRequestCase: vi.fn(),
  uploadDocumentAttachment: vi.fn(),
}));

vi.mock('../shared/hooks/useCustomerRequests', () => ({
  useTransitionCase: () => ({
    mutateAsync: vi.fn(),
  }),
}));

const makeProcessDetail = (
  partial?: Partial<NonNullable<YeuCauProcessDetail['yeu_cau']>>,
): YeuCauProcessDetail => ({
  yeu_cau: {
    id: 15,
    ...partial,
  },
} as YeuCauProcessDetail);

const buildHook = (processDetail: YeuCauProcessDetail | null) =>
  renderHook(() =>
    useCustomerRequestTransition({
      currentUserId: 9,
      selectedRequestId: null,
      transitionStatusCode: 'assigned_to_receiver',
      transitionProcessMeta: null,
      processDetail,
      people: [],
      defaultProcessor: null,
      taskReferenceLookup: new Map(),
      onNotify: vi.fn(),
      onTransitionSuccess: vi.fn(),
      bumpDataVersion: vi.fn(),
      caseContextIt360Tasks: [],
      caseContextReferenceTasks: [],
    }),
  );

describe('useCustomerRequestTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 18, 13, 47, 0));
    mockFetchYeuCauTimeline.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('prefills empty fixed datetime fields with today at 00:00', async () => {
    const { result } = buildHook(makeProcessDetail());

    await act(async () => {
      result.current.openTransitionModal();
      await Promise.resolve();
    });

    expect(result.current.modalStatusPayload).toMatchObject({
      received_at: '2026-04-18T00:00',
      completed_at: '2026-04-18T00:00',
      extended_at: '2026-04-18T00:00',
      from_user_id: '9',
    });
  });

  it('keeps current-case received_at instead of overwriting it with today at 00:00', async () => {
    const { result } = buildHook(
      makeProcessDetail({
        received_at: '2026-04-17 04:34:00',
      }),
    );

    await act(async () => {
      result.current.openTransitionModal();
      await Promise.resolve();
    });

    expect(result.current.modalStatusPayload).toMatchObject({
      received_at: '2026-04-17 04:34:00',
      completed_at: '2026-04-18T00:00',
      extended_at: '2026-04-18T00:00',
    });
  });

  it('lets payload overrides win over case values and fallback defaults', async () => {
    const { result } = buildHook(
      makeProcessDetail({
        received_at: '2026-04-17 04:34:00',
      }),
    );

    await act(async () => {
      result.current.openTransitionModal({
        payloadOverrides: {
          received_at: '2026-04-19T00:00',
          completed_at: '2026-04-20T00:00',
          extended_at: '',
        },
      });
      await Promise.resolve();
    });

    expect(result.current.modalStatusPayload).toMatchObject({
      received_at: '2026-04-19T00:00',
      completed_at: '2026-04-20T00:00',
      extended_at: '',
    });
  });

  it('keeps to_user_id empty by default even when current owner exists', async () => {
    const { result } = renderHook(() =>
      useCustomerRequestTransition({
        currentUserId: 9,
        selectedRequestId: null,
        transitionStatusCode: 'in_progress',
        transitionProcessMeta: null,
        processDetail: makeProcessDetail({
          current_owner_user_id: 21,
        }),
        people: [],
        defaultProcessor: null,
        taskReferenceLookup: new Map(),
        onNotify: vi.fn(),
        onTransitionSuccess: vi.fn(),
        bumpDataVersion: vi.fn(),
        caseContextIt360Tasks: [],
        caseContextReferenceTasks: [],
      }),
    );

    await act(async () => {
      result.current.openTransitionModal();
      await Promise.resolve();
    });

    expect(result.current.modalStatusPayload).toMatchObject({
      from_user_id: '9',
      to_user_id: '',
    });
  });
});
