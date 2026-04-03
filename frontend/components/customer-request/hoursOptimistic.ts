import type {
  YeuCau,
  YeuCauDashboardPayload,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauWorklog,
} from '../../types/customerRequest';

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;
const ALERT_REASON_CODES = ['missing_estimate', 'over_estimate', 'sla_risk'] as const;

export type DashboardAlertCountDelta = {
  missing_estimate: number;
  over_estimate: number;
  sla_risk: number;
};

const resolveDashboardAlertFlags = (
  request: YeuCau | null | undefined
): Record<keyof DashboardAlertCountDelta, boolean> => ({
  missing_estimate: Boolean(request?.missing_estimate || request?.warning_level === 'missing'),
  over_estimate: Boolean(request?.over_estimate || request?.warning_level === 'hard'),
  sla_risk: Boolean(request?.sla_status === 'at_risk' || request?.warning_level === 'soft'),
});

const calculateHoursUsagePct = (
  estimatedHours: number | null,
  totalHoursSpent: number
): number | null => {
  if (estimatedHours === null || estimatedHours <= 0) {
    return null;
  }

  return roundToTwo((totalHoursSpent / estimatedHours) * 100);
};

const resolveWarningLevel = (
  estimatedHours: number | null,
  totalHoursSpent: number
): string => {
  if (estimatedHours === null || estimatedHours <= 0) {
    return 'missing';
  }

  const usagePct = calculateHoursUsagePct(estimatedHours, totalHoursSpent) ?? 0;
  if (usagePct >= 100) {
    return 'hard';
  }
  if (usagePct >= 80) {
    return 'soft';
  }

  return 'normal';
};

export const prependUniqueWorklog = (
  worklogs: YeuCauWorklog[],
  worklog: YeuCauWorklog | null | undefined
): YeuCauWorklog[] => {
  if (!worklog) {
    return worklogs;
  }

  return [worklog, ...worklogs.filter((item) => String(item.id) !== String(worklog.id))];
};

export const prependUniqueEstimate = (
  estimates: YeuCauEstimate[],
  estimate: YeuCauEstimate | null | undefined
): YeuCauEstimate[] => {
  if (!estimate) {
    return estimates;
  }

  return [estimate, ...estimates.filter((item) => String(item.id) !== String(estimate.id))];
};

export const buildOptimisticEstimateHoursReport = ({
  currentHoursReport,
  requestCase,
  estimate,
  fallbackRequestCaseId,
}: {
  currentHoursReport: YeuCauHoursReport | null | undefined;
  requestCase: Partial<YeuCau> | null | undefined;
  estimate: YeuCauEstimate | null | undefined;
  fallbackRequestCaseId: string | number;
}): YeuCauHoursReport => {
  const totalHoursSpent =
    toFiniteNumber(requestCase?.total_hours_spent) ??
    toFiniteNumber(currentHoursReport?.total_hours_spent) ??
    0;
  const estimatedHours =
    toFiniteNumber(requestCase?.estimated_hours) ??
    toFiniteNumber(currentHoursReport?.estimated_hours);
  const usagePct = calculateHoursUsagePct(estimatedHours, totalHoursSpent);
  const warningLevel = resolveWarningLevel(estimatedHours, totalHoursSpent);

  return {
    request_case_id:
      requestCase?.id ??
      currentHoursReport?.request_case_id ??
      fallbackRequestCaseId,
    estimated_hours: estimatedHours,
    total_hours_spent: roundToTwo(totalHoursSpent),
    remaining_hours:
      estimatedHours === null ? null : roundToTwo(estimatedHours - totalHoursSpent),
    hours_usage_pct: usagePct,
    warning_level: warningLevel,
    over_estimate: warningLevel === 'hard',
    missing_estimate: estimatedHours === null || estimatedHours <= 0,
    latest_estimate: estimate ?? currentHoursReport?.latest_estimate ?? null,
    worklog_count: currentHoursReport?.worklog_count ?? 0,
    billable_hours: currentHoursReport?.billable_hours ?? 0,
    non_billable_hours:
      currentHoursReport?.non_billable_hours ??
      roundToTwo(totalHoursSpent - (currentHoursReport?.billable_hours ?? 0)),
    by_performer: currentHoursReport?.by_performer ?? [],
    by_activity: currentHoursReport?.by_activity ?? [],
  };
};

export const applyHoursReportToRequest = ({
  request,
  hoursReport,
  requestPatch,
}: {
  request: YeuCau | null | undefined;
  hoursReport: YeuCauHoursReport | null | undefined;
  requestPatch?: Partial<YeuCau> | null;
}): YeuCau | null => {
  const base = request ?? (requestPatch ? ({ ...requestPatch } as YeuCau) : null);
  if (!base) {
    return null;
  }

  const merged = requestPatch ? { ...base, ...requestPatch } : { ...base };

  if (!hoursReport) {
    return merged as YeuCau;
  }

  return {
    ...(merged as YeuCau),
    estimated_hours: hoursReport.estimated_hours ?? merged.estimated_hours ?? null,
    total_hours_spent: hoursReport.total_hours_spent ?? merged.total_hours_spent ?? 0,
    hours_usage_pct: hoursReport.hours_usage_pct ?? merged.hours_usage_pct ?? null,
    warning_level: hoursReport.warning_level ?? merged.warning_level ?? null,
    over_estimate: hoursReport.over_estimate ?? merged.over_estimate,
    missing_estimate: hoursReport.missing_estimate ?? merged.missing_estimate,
  };
};

export const applyRequestOverrides = (
  rows: YeuCau[],
  overrides: Record<string, YeuCau>
): YeuCau[] =>
  rows.map((row) => {
    const override = overrides[String(row.id)];
    return override ? { ...row, ...override } : row;
  });

export const applyRequestOverride = (
  request: YeuCau | null | undefined,
  overrides: Record<string, YeuCau>
): YeuCau | null => {
  if (!request?.id) {
    return request ?? null;
  }

  const override = overrides[String(request.id)];
  return override ? { ...request, ...override } : request;
};

export const deriveAttentionReasons = (
  request: YeuCau,
  baseReasons: string[]
): string[] => {
  const staticReasons = baseReasons.filter(
    (reason) => !ALERT_REASON_CODES.includes(reason as (typeof ALERT_REASON_CODES)[number])
  );
  const dynamicReasons: string[] = [];

  if (request.missing_estimate || request.warning_level === 'missing') {
    dynamicReasons.push('missing_estimate');
  }
  if (request.over_estimate || request.warning_level === 'hard') {
    dynamicReasons.push('over_estimate');
  }
  if (request.sla_status === 'at_risk' || request.warning_level === 'soft') {
    dynamicReasons.push('sla_risk');
  }

  return [...staticReasons, ...dynamicReasons];
};

export const applyRequestOverridesToDashboard = (
  dashboard: YeuCauDashboardPayload | null | undefined,
  overrides: Record<string, YeuCau>
): YeuCauDashboardPayload | null => {
  if (!dashboard) {
    return null;
  }

  return {
    ...dashboard,
    attention_cases: (dashboard.attention_cases ?? [])
      .map((attentionCase) => {
        const override = overrides[String(attentionCase.request_case?.id ?? '')];
        if (!override) {
          return attentionCase;
        }

        const requestCase = { ...attentionCase.request_case, ...override };
        const reasons = deriveAttentionReasons(requestCase, attentionCase.reasons ?? []);
        return reasons.length === 0
          ? null
          : {
              ...attentionCase,
              request_case: requestCase,
              reasons,
            };
      })
      .filter(
        (
          attentionCase
        ): attentionCase is NonNullable<YeuCauDashboardPayload['attention_cases'][number]> =>
          attentionCase !== null
      ),
  };
};

export const buildDashboardAlertCountDelta = (
  previousRequest: YeuCau | null | undefined,
  nextRequest: YeuCau | null | undefined
): DashboardAlertCountDelta => {
  const previousFlags = resolveDashboardAlertFlags(previousRequest);
  const nextFlags = resolveDashboardAlertFlags(nextRequest);

  return {
    missing_estimate: Number(nextFlags.missing_estimate) - Number(previousFlags.missing_estimate),
    over_estimate: Number(nextFlags.over_estimate) - Number(previousFlags.over_estimate),
    sla_risk: Number(nextFlags.sla_risk) - Number(previousFlags.sla_risk),
  };
};

export const applyDashboardAlertCountDelta = (
  dashboard: YeuCauDashboardPayload | null | undefined,
  delta: DashboardAlertCountDelta
): YeuCauDashboardPayload | null => {
  if (!dashboard) {
    return null;
  }

  return {
    ...dashboard,
    summary: {
      ...dashboard.summary,
      alert_counts: {
        over_estimate: Math.max(0, (dashboard.summary.alert_counts.over_estimate ?? 0) + delta.over_estimate),
        missing_estimate: Math.max(0, (dashboard.summary.alert_counts.missing_estimate ?? 0) + delta.missing_estimate),
        sla_risk: Math.max(0, (dashboard.summary.alert_counts.sla_risk ?? 0) + delta.sla_risk),
      },
    },
  };
};
