import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProjectType,
  fetchProjectTypes,
  updateProjectType,
} from '../services/api/projectApi';
import {
  createSupportContactPosition,
  createSupportContactPositionsBulk,
  createSupportRequestStatus,
  createSupportServiceGroup,
  createSupportSlaConfig,
  createWorklogActivityType,
  fetchSupportContactPositions,
  fetchSupportRequestStatuses,
  fetchSupportServiceGroups,
  fetchSupportSlaConfigs,
  fetchWorklogActivityTypes,
  updateSupportContactPosition,
  updateSupportRequestStatusDefinition,
  updateSupportServiceGroup,
  updateSupportSlaConfig,
  updateWorklogActivityType,
} from '../services/api/supportConfigApi';
import { queryKeys } from '../shared/queryKeys';
import type { BulkMutationResult } from '../types/common';
import type { ProjectTypeOption } from '../types/project';
import type {
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorklogActivityTypeOption,
} from '../types/support';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface UseSupportConfigOptions {
  enabled?: boolean;
  includeInactive?: boolean;
}

interface UseSupportConfigReturn {
  supportServiceGroups: SupportServiceGroup[];
  supportContactPositions: SupportContactPosition[];
  supportRequestStatuses: SupportRequestStatusOption[];
  projectTypes: ProjectTypeOption[];
  worklogActivityTypes: WorklogActivityTypeOption[];
  supportSlaConfigs: SupportSlaConfigOption[];
  isLoading: boolean;
  error: string | null;
  refreshSupportConfig: () => Promise<void>;
  handleCreateSupportServiceGroup: (payload: Partial<SupportServiceGroup>, options?: { silent?: boolean }) => Promise<SupportServiceGroup>;
  handleUpdateSupportServiceGroup: (id: string | number, payload: Partial<SupportServiceGroup>, options?: { silent?: boolean }) => Promise<SupportServiceGroup>;
  handleCreateSupportContactPosition: (payload: Partial<SupportContactPosition>, options?: { silent?: boolean }) => Promise<SupportContactPosition>;
  handleCreateSupportContactPositionsBulk: (payload: Array<Partial<SupportContactPosition>>, options?: { silent?: boolean }) => Promise<BulkMutationResult<SupportContactPosition>>;
  handleUpdateSupportContactPosition: (id: string | number, payload: Partial<SupportContactPosition>, options?: { silent?: boolean }) => Promise<SupportContactPosition>;
  handleCreateSupportRequestStatus: (payload: Partial<SupportRequestStatusOption>, options?: { silent?: boolean }) => Promise<SupportRequestStatusOption>;
  handleUpdateSupportRequestStatus: (id: string | number, payload: Partial<SupportRequestStatusOption>, options?: { silent?: boolean }) => Promise<SupportRequestStatusOption>;
  handleCreateProjectType: (payload: Partial<ProjectTypeOption>, options?: { silent?: boolean }) => Promise<ProjectTypeOption>;
  handleUpdateProjectType: (id: string | number, payload: Partial<ProjectTypeOption>, options?: { silent?: boolean }) => Promise<ProjectTypeOption>;
  handleCreateWorklogActivityType: (payload: Partial<WorklogActivityTypeOption>, options?: { silent?: boolean }) => Promise<WorklogActivityTypeOption>;
  handleUpdateWorklogActivityType: (id: string | number, payload: Partial<WorklogActivityTypeOption>, options?: { silent?: boolean }) => Promise<WorklogActivityTypeOption>;
  handleCreateSupportSlaConfig: (payload: Partial<SupportSlaConfigOption>, options?: { silent?: boolean }) => Promise<SupportSlaConfigOption>;
  handleUpdateSupportSlaConfig: (id: string | number, payload: Partial<SupportSlaConfigOption>, options?: { silent?: boolean }) => Promise<SupportSlaConfigOption>;
}

const extractErrorMessage = (error: unknown, fallback = 'Lỗi không xác định'): string =>
  error instanceof Error ? error.message : fallback;

const prependOrReplaceById = <T extends { id?: string | number | null }>(items: T[] | undefined, nextItem: T): T[] => {
  const current = items ?? [];
  return [
    nextItem,
    ...current.filter((item) => String(item.id ?? '') !== String(nextItem.id ?? '')),
  ];
};

const replaceById = <T extends { id?: string | number | null }>(items: T[] | undefined, nextItem: T): T[] =>
  (items ?? []).map((item) =>
    String(item.id ?? '') === String(nextItem.id ?? '') ? nextItem : item,
  );

type MutationOptions = { silent?: boolean };

export function useSupportConfig(
  addToast?: ToastFn,
  options: UseSupportConfigOptions = {},
): UseSupportConfigReturn {
  const enabled = options.enabled ?? true;
  const includeInactive = options.includeInactive ?? false;
  const queryClient = useQueryClient();

  const serviceGroupsKey = queryKeys.supportConfig.serviceGroups({ include_inactive: includeInactive });
  const contactPositionsKey = queryKeys.supportConfig.contactPositions({ include_inactive: includeInactive });
  const requestStatusesKey = queryKeys.supportConfig.requestStatuses({ include_inactive: includeInactive });
  const projectTypesKey = queryKeys.supportConfig.projectTypes({ include_inactive: includeInactive });
  const worklogActivityTypesKey = queryKeys.supportConfig.worklogActivityTypes({ include_inactive: includeInactive });
  const slaConfigsKey = queryKeys.supportConfig.slaConfigs({ include_inactive: includeInactive });

  const serviceGroupsQuery = useQuery({
    queryKey: serviceGroupsKey,
    queryFn: () => fetchSupportServiceGroups(includeInactive),
    enabled,
  });

  const contactPositionsQuery = useQuery({
    queryKey: contactPositionsKey,
    queryFn: () => fetchSupportContactPositions(includeInactive),
    enabled,
  });

  const requestStatusesQuery = useQuery({
    queryKey: requestStatusesKey,
    queryFn: () => fetchSupportRequestStatuses(includeInactive),
    enabled,
  });

  const projectTypesQuery = useQuery({
    queryKey: projectTypesKey,
    queryFn: () => fetchProjectTypes(includeInactive),
    enabled,
  });

  const worklogActivityTypesQuery = useQuery({
    queryKey: worklogActivityTypesKey,
    queryFn: () => fetchWorklogActivityTypes(includeInactive),
    enabled,
  });

  const slaConfigsQuery = useQuery({
    queryKey: slaConfigsKey,
    queryFn: () => fetchSupportSlaConfigs(includeInactive),
    enabled,
  });

  const createSupportServiceGroupMutation = useMutation({ mutationFn: createSupportServiceGroup });
  const updateSupportServiceGroupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<SupportServiceGroup> }) =>
      updateSupportServiceGroup(id, payload),
  });
  const createSupportContactPositionMutation = useMutation({ mutationFn: createSupportContactPosition });
  const updateSupportContactPositionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<SupportContactPosition> }) =>
      updateSupportContactPosition(id, payload),
  });
  const createSupportContactPositionsBulkMutation = useMutation({
    mutationFn: createSupportContactPositionsBulk,
  });
  const createSupportRequestStatusMutation = useMutation({ mutationFn: createSupportRequestStatus });
  const updateSupportRequestStatusMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<SupportRequestStatusOption> }) =>
      updateSupportRequestStatusDefinition(id, payload),
  });
  const createProjectTypeMutation = useMutation({ mutationFn: createProjectType });
  const updateProjectTypeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<ProjectTypeOption> }) =>
      updateProjectType(id, payload),
  });
  const createWorklogActivityTypeMutation = useMutation({ mutationFn: createWorklogActivityType });
  const updateWorklogActivityTypeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<WorklogActivityTypeOption> }) =>
      updateWorklogActivityType(id, payload),
  });
  const createSupportSlaConfigMutation = useMutation({ mutationFn: createSupportSlaConfig });
  const updateSupportSlaConfigMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<SupportSlaConfigOption> }) =>
      updateSupportSlaConfig(id, payload),
  });

  const refreshSupportConfig = useCallback(async () => {
    await Promise.all([
      serviceGroupsQuery.refetch(),
      contactPositionsQuery.refetch(),
      requestStatusesQuery.refetch(),
      projectTypesQuery.refetch(),
      worklogActivityTypesQuery.refetch(),
      slaConfigsQuery.refetch(),
    ]);
  }, [
    contactPositionsQuery,
    projectTypesQuery,
    requestStatusesQuery,
    serviceGroupsQuery,
    slaConfigsQuery,
    worklogActivityTypesQuery,
  ]);

  const updateCachedList = useCallback(<T extends { id?: string | number | null }>(
    key: readonly unknown[],
    updater: (current: T[] | undefined) => T[],
  ) => {
    queryClient.setQueryData(key, (current: T[] | undefined) => updater(current));
  }, [queryClient]);

  const withSilentToast = useCallback(async <T,>(
    runner: () => Promise<T>,
    successTitle: string,
    successMessage: string,
    errorTitle: string,
    options?: { silent?: boolean },
  ): Promise<T> => {
    try {
      const result = await runner();
      if (!options?.silent) {
        addToast?.('success', successTitle, successMessage);
      }
      return result;
    } catch (error) {
      if (!options?.silent) {
        addToast?.('error', errorTitle, extractErrorMessage(error));
      }
      throw error;
    }
  }, [addToast]);

  const error =
    extractErrorMessage(serviceGroupsQuery.error, '') ||
    extractErrorMessage(contactPositionsQuery.error, '') ||
    extractErrorMessage(requestStatusesQuery.error, '') ||
    extractErrorMessage(projectTypesQuery.error, '') ||
    extractErrorMessage(worklogActivityTypesQuery.error, '') ||
    extractErrorMessage(slaConfigsQuery.error, '') ||
    null;

  const handleCreateSupportServiceGroup: UseSupportConfigReturn['handleCreateSupportServiceGroup'] = useCallback(async (payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const created = await createSupportServiceGroupMutation.mutateAsync(payload);
      updateCachedList<SupportServiceGroup>(serviceGroupsKey, (current) => prependOrReplaceById(current, created));
      return created;
    }, 'Thành công', 'Đã thêm nhóm hỗ trợ.', 'Tạo nhóm hỗ trợ thất bại', mutationOptions);
  }, [createSupportServiceGroupMutation, serviceGroupsKey, updateCachedList, withSilentToast]);

  const handleUpdateSupportServiceGroup: UseSupportConfigReturn['handleUpdateSupportServiceGroup'] = useCallback(async (id, payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const updated = await updateSupportServiceGroupMutation.mutateAsync({ id, payload });
      updateCachedList<SupportServiceGroup>(serviceGroupsKey, (current) => replaceById(current, updated));
      return updated;
    }, 'Thành công', 'Đã cập nhật nhóm hỗ trợ.', 'Cập nhật nhóm hỗ trợ thất bại', mutationOptions);
  }, [serviceGroupsKey, updateCachedList, updateSupportServiceGroupMutation, withSilentToast]);

  const handleCreateSupportContactPosition: UseSupportConfigReturn['handleCreateSupportContactPosition'] = useCallback(async (payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const created = await createSupportContactPositionMutation.mutateAsync(payload);
      updateCachedList<SupportContactPosition>(contactPositionsKey, (current) => prependOrReplaceById(current, created));
      return created;
    }, 'Thành công', 'Đã thêm chức vụ liên hệ.', 'Tạo chức vụ liên hệ thất bại', mutationOptions);
  }, [contactPositionsKey, createSupportContactPositionMutation, updateCachedList, withSilentToast]);

  const handleCreateSupportContactPositionsBulk: UseSupportConfigReturn['handleCreateSupportContactPositionsBulk'] = useCallback(async (payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const result = await createSupportContactPositionsBulkMutation.mutateAsync(payload);
      await queryClient.invalidateQueries({ queryKey: contactPositionsKey });
      return result;
    }, 'Thành công', 'Đã nhập danh sách chức vụ liên hệ.', 'Nhập chức vụ liên hệ thất bại', mutationOptions);
  }, [contactPositionsKey, createSupportContactPositionsBulkMutation, queryClient, withSilentToast]);

  const handleUpdateSupportContactPosition: UseSupportConfigReturn['handleUpdateSupportContactPosition'] = useCallback(async (id, payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const updated = await updateSupportContactPositionMutation.mutateAsync({ id, payload });
      updateCachedList<SupportContactPosition>(contactPositionsKey, (current) => replaceById(current, updated));
      return updated;
    }, 'Thành công', 'Đã cập nhật chức vụ liên hệ.', 'Cập nhật chức vụ liên hệ thất bại', mutationOptions);
  }, [contactPositionsKey, updateCachedList, updateSupportContactPositionMutation, withSilentToast]);

  const handleCreateSupportRequestStatus: UseSupportConfigReturn['handleCreateSupportRequestStatus'] = useCallback(async (payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const created = await createSupportRequestStatusMutation.mutateAsync(payload);
      updateCachedList<SupportRequestStatusOption>(requestStatusesKey, (current) => prependOrReplaceById(current, created));
      return created;
    }, 'Thành công', 'Đã thêm trạng thái yêu cầu.', 'Tạo trạng thái yêu cầu thất bại', mutationOptions);
  }, [createSupportRequestStatusMutation, requestStatusesKey, updateCachedList, withSilentToast]);

  const handleUpdateSupportRequestStatus: UseSupportConfigReturn['handleUpdateSupportRequestStatus'] = useCallback(async (id, payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const updated = await updateSupportRequestStatusMutation.mutateAsync({ id, payload });
      updateCachedList<SupportRequestStatusOption>(requestStatusesKey, (current) => replaceById(current, updated));
      return updated;
    }, 'Thành công', 'Đã cập nhật trạng thái yêu cầu.', 'Cập nhật trạng thái yêu cầu thất bại', mutationOptions);
  }, [requestStatusesKey, updateCachedList, updateSupportRequestStatusMutation, withSilentToast]);

  const handleCreateProjectType: UseSupportConfigReturn['handleCreateProjectType'] = useCallback(async (payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const created = await createProjectTypeMutation.mutateAsync(payload);
      updateCachedList<ProjectTypeOption>(projectTypesKey, (current) => prependOrReplaceById(current, created));
      return created;
    }, 'Thành công', 'Đã thêm loại dự án.', 'Tạo loại dự án thất bại', mutationOptions);
  }, [createProjectTypeMutation, projectTypesKey, updateCachedList, withSilentToast]);

  const handleUpdateProjectType: UseSupportConfigReturn['handleUpdateProjectType'] = useCallback(async (id, payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const updated = await updateProjectTypeMutation.mutateAsync({ id, payload });
      updateCachedList<ProjectTypeOption>(projectTypesKey, (current) => replaceById(current, updated));
      return updated;
    }, 'Thành công', 'Đã cập nhật loại dự án.', 'Cập nhật loại dự án thất bại', mutationOptions);
  }, [projectTypesKey, updateCachedList, updateProjectTypeMutation, withSilentToast]);

  const handleCreateWorklogActivityType: UseSupportConfigReturn['handleCreateWorklogActivityType'] = useCallback(async (payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const created = await createWorklogActivityTypeMutation.mutateAsync(payload);
      updateCachedList<WorklogActivityTypeOption>(worklogActivityTypesKey, (current) => prependOrReplaceById(current, created));
      return created;
    }, 'Thành công', 'Đã thêm loại công việc.', 'Tạo loại công việc thất bại', mutationOptions);
  }, [createWorklogActivityTypeMutation, updateCachedList, withSilentToast, worklogActivityTypesKey]);

  const handleUpdateWorklogActivityType: UseSupportConfigReturn['handleUpdateWorklogActivityType'] = useCallback(async (id, payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const updated = await updateWorklogActivityTypeMutation.mutateAsync({ id, payload });
      updateCachedList<WorklogActivityTypeOption>(worklogActivityTypesKey, (current) => replaceById(current, updated));
      return updated;
    }, 'Thành công', 'Đã cập nhật loại công việc.', 'Cập nhật loại công việc thất bại', mutationOptions);
  }, [updateCachedList, updateWorklogActivityTypeMutation, withSilentToast, worklogActivityTypesKey]);

  const handleCreateSupportSlaConfig: UseSupportConfigReturn['handleCreateSupportSlaConfig'] = useCallback(async (payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const created = await createSupportSlaConfigMutation.mutateAsync(payload);
      updateCachedList<SupportSlaConfigOption>(slaConfigsKey, (current) => prependOrReplaceById(current, created));
      return created;
    }, 'Thành công', 'Đã thêm cấu hình SLA.', 'Tạo cấu hình SLA thất bại', mutationOptions);
  }, [createSupportSlaConfigMutation, slaConfigsKey, updateCachedList, withSilentToast]);

  const handleUpdateSupportSlaConfig: UseSupportConfigReturn['handleUpdateSupportSlaConfig'] = useCallback(async (id, payload, mutationOptions) => {
    return await withSilentToast(async () => {
      const updated = await updateSupportSlaConfigMutation.mutateAsync({ id, payload });
      updateCachedList<SupportSlaConfigOption>(slaConfigsKey, (current) => replaceById(current, updated));
      return updated;
    }, 'Thành công', 'Đã cập nhật cấu hình SLA.', 'Cập nhật cấu hình SLA thất bại', mutationOptions);
  }, [slaConfigsKey, updateCachedList, updateSupportSlaConfigMutation, withSilentToast]);

  return {
    supportServiceGroups: serviceGroupsQuery.data ?? [],
    supportContactPositions: contactPositionsQuery.data ?? [],
    supportRequestStatuses: requestStatusesQuery.data ?? [],
    projectTypes: projectTypesQuery.data ?? [],
    worklogActivityTypes: worklogActivityTypesQuery.data ?? [],
    supportSlaConfigs: slaConfigsQuery.data ?? [],
    isLoading:
      serviceGroupsQuery.isLoading ||
      contactPositionsQuery.isLoading ||
      requestStatusesQuery.isLoading ||
      projectTypesQuery.isLoading ||
      worklogActivityTypesQuery.isLoading ||
      slaConfigsQuery.isLoading ||
      serviceGroupsQuery.isFetching ||
      contactPositionsQuery.isFetching ||
      requestStatusesQuery.isFetching ||
      projectTypesQuery.isFetching ||
      worklogActivityTypesQuery.isFetching ||
      slaConfigsQuery.isFetching,
    error,
    refreshSupportConfig,
    handleCreateSupportServiceGroup,
    handleUpdateSupportServiceGroup,
    handleCreateSupportContactPosition,
    handleCreateSupportContactPositionsBulk,
    handleUpdateSupportContactPosition,
    handleCreateSupportRequestStatus,
    handleUpdateSupportRequestStatus,
    handleCreateProjectType,
    handleUpdateProjectType,
    handleCreateWorklogActivityType,
    handleUpdateWorklogActivityType,
    handleCreateSupportSlaConfig,
    handleUpdateSupportSlaConfig,
  };
}
