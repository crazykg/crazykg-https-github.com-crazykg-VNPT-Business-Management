import { describe, expect, it } from 'vitest';
import {
  applyDashboardAlertCountDelta,
  applyHoursReportToRequest,
  applyRequestOverrides,
  applyRequestOverridesToDashboard,
  buildDashboardAlertCountDelta,
  buildOptimisticEstimateHoursReport,
  prependUniqueEstimate,
  prependUniqueWorklog,
} from '../components/customer-request/hoursOptimistic';

describe('customer request optimistic hours helpers', () => {
  it('prepends unique worklogs and estimates without duplicating the latest item', () => {
    expect(
      prependUniqueWorklog(
        [
          { id: 10, work_content: 'cũ' },
          { id: 9, work_content: 'cũ hơn' },
        ],
        { id: 10, work_content: 'mới nhất' }
      )
    ).toEqual([
      { id: 10, work_content: 'mới nhất' },
      { id: 9, work_content: 'cũ hơn' },
    ]);

    expect(
      prependUniqueEstimate(
        [
          { id: 4, estimated_hours: 6 },
          { id: 3, estimated_hours: 4 },
        ],
        { id: 4, estimated_hours: 8 }
      )
    ).toEqual([
      { id: 4, estimated_hours: 8 },
      { id: 3, estimated_hours: 4 },
    ]);
  });

  it('recomputes hours report immediately after an estimate update', () => {
    const hoursReport = buildOptimisticEstimateHoursReport({
      currentHoursReport: {
        request_case_id: 8,
        estimated_hours: 12,
        total_hours_spent: 3.5,
        remaining_hours: 8.5,
        hours_usage_pct: 29.17,
        warning_level: 'normal',
        over_estimate: false,
        missing_estimate: false,
        latest_estimate: { id: 1, estimated_hours: 12 },
        worklog_count: 2,
        billable_hours: 3,
        non_billable_hours: 0.5,
        by_performer: [{ performed_by_user_id: 5, performed_by_name: 'Mai', hours_spent: 3.5 }],
        by_activity: [{ activity_type_code: 'analysis', hours_spent: 3.5, worklog_count: 2 }],
      },
      requestCase: {
        id: 8,
        estimated_hours: 4,
        total_hours_spent: 4.5,
      },
      estimate: {
        id: 2,
        estimated_hours: 4,
        estimate_scope: 'total',
      },
      fallbackRequestCaseId: 8,
    });

    expect(hoursReport.estimated_hours).toBe(4);
    expect(hoursReport.total_hours_spent).toBe(4.5);
    expect(hoursReport.remaining_hours).toBe(-0.5);
    expect(hoursReport.hours_usage_pct).toBe(112.5);
    expect(hoursReport.warning_level).toBe('hard');
    expect(hoursReport.over_estimate).toBe(true);
    expect(hoursReport.latest_estimate?.id).toBe(2);
    expect(hoursReport.worklog_count).toBe(2);
  });

  it('applies updated hours data onto request summary fields', () => {
    expect(
      applyHoursReportToRequest({
        request: {
          id: 8,
          ma_yc: 'CRC-202603-0008',
          request_code: 'CRC-202603-0008',
          tieu_de: 'Hỗ trợ LIS',
          trang_thai: 'in_progress',
          do_uu_tien: 2,
          ket_qua: 'dang_xu_ly',
          estimated_hours: 8,
          total_hours_spent: 2,
        },
        requestPatch: {
          estimated_at: '2026-03-23 10:00:00',
        },
        hoursReport: {
          request_case_id: 8,
          estimated_hours: 10,
          total_hours_spent: 7,
          remaining_hours: 3,
          hours_usage_pct: 70,
          warning_level: 'normal',
          over_estimate: false,
          missing_estimate: false,
        },
      })
    ).toMatchObject({
      estimated_hours: 10,
      total_hours_spent: 7,
      hours_usage_pct: 70,
      warning_level: 'normal',
      estimated_at: '2026-03-23 10:00:00',
    });
  });

  it('overlays request rows and attention cards with optimistic request data', () => {
    expect(
      applyRequestOverrides(
        [
          {
            id: 8,
            ma_yc: 'CRC-202603-0008',
            request_code: 'CRC-202603-0008',
            tieu_de: 'Hỗ trợ LIS',
            trang_thai: 'in_progress',
            do_uu_tien: 2,
            ket_qua: 'dang_xu_ly',
            estimated_hours: null,
            total_hours_spent: 2,
            missing_estimate: true,
          },
        ],
        {
          '8': {
            id: 8,
            ma_yc: 'CRC-202603-0008',
            request_code: 'CRC-202603-0008',
            tieu_de: 'Hỗ trợ LIS',
            trang_thai: 'in_progress',
            do_uu_tien: 2,
            ket_qua: 'dang_xu_ly',
            estimated_hours: 10,
            total_hours_spent: 7,
            missing_estimate: false,
            warning_level: 'normal',
          },
        }
      )[0]
    ).toMatchObject({
      estimated_hours: 10,
      total_hours_spent: 7,
      missing_estimate: false,
    });

    expect(
      applyRequestOverridesToDashboard(
        {
          role: 'overview',
          summary: {
            total_cases: 1,
            status_counts: [],
            alert_counts: {
              missing_estimate: 1,
              over_estimate: 0,
              sla_risk: 0,
            },
          },
          top_customers: [],
          top_projects: [],
          top_performers: [],
          attention_cases: [
            {
              request_case: {
                id: 8,
                ma_yc: 'CRC-202603-0008',
                request_code: 'CRC-202603-0008',
                tieu_de: 'Hỗ trợ LIS',
                trang_thai: 'in_progress',
                do_uu_tien: 2,
                ket_qua: 'dang_xu_ly',
                estimated_hours: null,
                total_hours_spent: 2,
                missing_estimate: true,
              },
              reasons: ['missing_estimate'],
            },
          ],
        },
        {
          '8': {
            id: 8,
            ma_yc: 'CRC-202603-0008',
            request_code: 'CRC-202603-0008',
            tieu_de: 'Hỗ trợ LIS',
            trang_thai: 'in_progress',
            do_uu_tien: 2,
            ket_qua: 'dang_xu_ly',
            estimated_hours: 10,
            total_hours_spent: 7,
            missing_estimate: false,
            warning_level: 'normal',
          },
        }
      )?.attention_cases ?? []
    ).toHaveLength(0);
  });

  it('builds and applies alert count deltas without guessing unrelated counters', () => {
    const delta = buildDashboardAlertCountDelta(
      {
        id: 8,
        ma_yc: 'CRC-202603-0008',
        request_code: 'CRC-202603-0008',
        tieu_de: 'Hỗ trợ LIS',
        trang_thai: 'in_progress',
        do_uu_tien: 2,
        ket_qua: 'dang_xu_ly',
        missing_estimate: true,
        warning_level: 'missing',
      },
      {
        id: 8,
        ma_yc: 'CRC-202603-0008',
        request_code: 'CRC-202603-0008',
        tieu_de: 'Hỗ trợ LIS',
        trang_thai: 'in_progress',
        do_uu_tien: 2,
        ket_qua: 'dang_xu_ly',
        missing_estimate: false,
        over_estimate: true,
        warning_level: 'hard',
      }
    );

    expect(delta).toEqual({
      missing_estimate: -1,
      over_estimate: 1,
      sla_risk: 0,
    });

    expect(
      applyDashboardAlertCountDelta(
        {
          role: 'overview',
          summary: {
            total_cases: 5,
            status_counts: [],
            alert_counts: {
              missing_estimate: 3,
              over_estimate: 1,
              sla_risk: 2,
            },
          },
          top_customers: [],
          top_projects: [],
          top_performers: [],
          attention_cases: [],
        },
        delta
      )?.summary.alert_counts
    ).toEqual({
      missing_estimate: 2,
      over_estimate: 2,
      sla_risk: 2,
    });
  });
});
