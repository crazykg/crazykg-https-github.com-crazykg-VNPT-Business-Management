import { useCallback, useEffect, useMemo, useState } from 'react';
import type { YeuCau, YeuCauDashboardPayload } from '../../../types';
import {
  applyDashboardAlertCountDelta,
  applyRequestOverride,
  applyRequestOverrides,
  applyRequestOverridesToDashboard,
  buildDashboardAlertCountDelta,
} from '../hoursOptimistic';
import { splitCreatorWorkspaceRows } from '../creatorWorkspace';
import {
  buildDispatcherPmWatchRows,
  buildDispatcherTeamLoadRows,
  splitDispatcherWorkspaceRows,
} from '../dispatcherWorkspace';
import { splitPerformerWorkspaceRows } from '../performerWorkspace';

type UseCustomerRequestOptimisticStateOptions = {
  currentUserId?: string | number | null;
  dataVersion: number;
  listRows: YeuCau[];
  creatorRows: YeuCau[];
  dispatcherRows: YeuCau[];
  performerRows: YeuCau[];
  overviewDashboard: YeuCauDashboardPayload | null;
  roleDashboards: Record<'creator' | 'dispatcher' | 'performer', YeuCauDashboardPayload | null>;
};

const EMPTY_ALERT_COUNT_DELTA = {
  missing_estimate: 0,
  over_estimate: 0,
  sla_risk: 0,
} as const;

type DashboardAlertCountDelta = {
  missing_estimate: number;
  over_estimate: number;
  sla_risk: number;
};

type DashboardAlertCountDeltaState = Record<
  'overview' | 'creator' | 'dispatcher' | 'performer',
  DashboardAlertCountDelta
>;

const createEmptyDashboardAlertCountDeltaState = (): DashboardAlertCountDeltaState => ({
  overview: { ...EMPTY_ALERT_COUNT_DELTA },
  creator: { ...EMPTY_ALERT_COUNT_DELTA },
  dispatcher: { ...EMPTY_ALERT_COUNT_DELTA },
  performer: { ...EMPTY_ALERT_COUNT_DELTA },
});

export const useCustomerRequestOptimisticState = ({
  currentUserId,
  dataVersion,
  listRows,
  creatorRows,
  dispatcherRows,
  performerRows,
  overviewDashboard,
  roleDashboards,
}: UseCustomerRequestOptimisticStateOptions) => {
  const [optimisticRequestOverrides, setOptimisticRequestOverrides] = useState<Record<string, YeuCau>>({});
  const [dashboardAlertCountDeltas, setDashboardAlertCountDeltas] = useState<DashboardAlertCountDeltaState>(
    createEmptyDashboardAlertCountDeltaState
  );

  useEffect(() => {
    if (dataVersion === 0) {
      return;
    }

    setOptimisticRequestOverrides({});
    setDashboardAlertCountDeltas(createEmptyDashboardAlertCountDeltaState());
  }, [dataVersion]);

  const requestBelongsToRoleDashboard = useCallback(
    (
      request: YeuCau | null | undefined,
      role: 'creator' | 'dispatcher' | 'performer'
    ): boolean => {
      if (!request || currentUserId === null || currentUserId === undefined) {
        return false;
      }

      const currentUserKey = String(currentUserId);
      switch (role) {
        case 'creator':
          return [request.created_by, request.nguoi_tao_id].some(
            (value) => String(value ?? '') === currentUserKey
          );
        case 'dispatcher':
          return [request.dispatcher_user_id, request.received_by_user_id].some(
            (value) => String(value ?? '') === currentUserKey
          );
        case 'performer':
          return String(request.performer_user_id ?? '') === currentUserKey;
        default:
          return false;
      }
    },
    [currentUserId]
  );

  const registerOptimisticRequestUpdate = useCallback(
    (previousRequest: YeuCau | null | undefined, nextRequest: YeuCau | null | undefined) => {
      if (nextRequest?.id) {
        setOptimisticRequestOverrides((prev) => ({
          ...prev,
          [String(nextRequest.id)]: nextRequest,
        }));
      }

      const delta = buildDashboardAlertCountDelta(previousRequest, nextRequest);
      if (
        delta.missing_estimate === 0 &&
        delta.over_estimate === 0 &&
        delta.sla_risk === 0
      ) {
        return;
      }

      const membershipRequest = nextRequest ?? previousRequest;

      setDashboardAlertCountDeltas((prev) => ({
        overview: {
          missing_estimate: prev.overview.missing_estimate + delta.missing_estimate,
          over_estimate: prev.overview.over_estimate + delta.over_estimate,
          sla_risk: prev.overview.sla_risk + delta.sla_risk,
        },
        creator: requestBelongsToRoleDashboard(membershipRequest, 'creator')
          ? {
              missing_estimate: prev.creator.missing_estimate + delta.missing_estimate,
              over_estimate: prev.creator.over_estimate + delta.over_estimate,
              sla_risk: prev.creator.sla_risk + delta.sla_risk,
            }
          : prev.creator,
        dispatcher: requestBelongsToRoleDashboard(membershipRequest, 'dispatcher')
          ? {
              missing_estimate: prev.dispatcher.missing_estimate + delta.missing_estimate,
              over_estimate: prev.dispatcher.over_estimate + delta.over_estimate,
              sla_risk: prev.dispatcher.sla_risk + delta.sla_risk,
            }
          : prev.dispatcher,
        performer: requestBelongsToRoleDashboard(membershipRequest, 'performer')
          ? {
              missing_estimate: prev.performer.missing_estimate + delta.missing_estimate,
              over_estimate: prev.performer.over_estimate + delta.over_estimate,
              sla_risk: prev.performer.sla_risk + delta.sla_risk,
            }
          : prev.performer,
      }));
    },
    [requestBelongsToRoleDashboard]
  );

  const getPatchedRequest = useCallback(
    (request: YeuCau | null | undefined): YeuCau | null =>
      applyRequestOverride(request, optimisticRequestOverrides),
    [optimisticRequestOverrides]
  );

  const patchedListRows = useMemo(
    () => applyRequestOverrides(listRows, optimisticRequestOverrides),
    [listRows, optimisticRequestOverrides]
  );
  const patchedCreatorRows = useMemo(
    () => applyRequestOverrides(creatorRows, optimisticRequestOverrides),
    [creatorRows, optimisticRequestOverrides]
  );
  const patchedCreatorBuckets = useMemo(
    () => splitCreatorWorkspaceRows(patchedCreatorRows),
    [patchedCreatorRows]
  );
  const patchedDispatcherRows = useMemo(
    () => applyRequestOverrides(dispatcherRows, optimisticRequestOverrides),
    [dispatcherRows, optimisticRequestOverrides]
  );
  const patchedDispatcherBuckets = useMemo(
    () => splitDispatcherWorkspaceRows(patchedDispatcherRows),
    [patchedDispatcherRows]
  );
  const patchedDispatcherTeamLoadRows = useMemo(
    () => buildDispatcherTeamLoadRows(patchedDispatcherRows),
    [patchedDispatcherRows]
  );
  const patchedDispatcherPmWatchRows = useMemo(
    () => buildDispatcherPmWatchRows(patchedDispatcherRows),
    [patchedDispatcherRows]
  );
  const patchedPerformerRows = useMemo(
    () => applyRequestOverrides(performerRows, optimisticRequestOverrides),
    [performerRows, optimisticRequestOverrides]
  );
  const patchedPerformerBuckets = useMemo(
    () => splitPerformerWorkspaceRows(patchedPerformerRows),
    [patchedPerformerRows]
  );
  const patchedOverviewDashboard = useMemo(
    () =>
      applyDashboardAlertCountDelta(
        applyRequestOverridesToDashboard(overviewDashboard, optimisticRequestOverrides),
        dashboardAlertCountDeltas.overview
      ),
    [dashboardAlertCountDeltas.overview, optimisticRequestOverrides, overviewDashboard]
  );
  const patchedRoleDashboards = useMemo(
    () => ({
      creator: applyDashboardAlertCountDelta(
        applyRequestOverridesToDashboard(roleDashboards.creator, optimisticRequestOverrides),
        dashboardAlertCountDeltas.creator
      ),
      dispatcher: applyDashboardAlertCountDelta(
        applyRequestOverridesToDashboard(roleDashboards.dispatcher, optimisticRequestOverrides),
        dashboardAlertCountDeltas.dispatcher
      ),
      performer: applyDashboardAlertCountDelta(
        applyRequestOverridesToDashboard(roleDashboards.performer, optimisticRequestOverrides),
        dashboardAlertCountDeltas.performer
      ),
    }),
    [
      dashboardAlertCountDeltas.creator,
      dashboardAlertCountDeltas.dispatcher,
      dashboardAlertCountDeltas.performer,
      optimisticRequestOverrides,
      roleDashboards.creator,
      roleDashboards.dispatcher,
      roleDashboards.performer,
    ]
  );

  return {
    registerOptimisticRequestUpdate,
    getPatchedRequest,
    patchedListRows,
    patchedCreatorRows,
    patchedCreatorBuckets,
    patchedDispatcherRows,
    patchedDispatcherBuckets,
    patchedDispatcherTeamLoadRows,
    patchedDispatcherPmWatchRows,
    patchedPerformerRows,
    patchedPerformerBuckets,
    patchedOverviewDashboard,
    patchedRoleDashboards,
  };
};
