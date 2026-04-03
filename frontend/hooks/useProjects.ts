import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjects,
  fetchProjectsPage,
  fetchProjectDetail,
  fetchProjectItems,
  fetchProjectRaciAssignments,
  createProject,
  updateProject,
  deleteProject,
} from '../services/api/projectApi';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { queryKeys } from '../shared/queryKeys';
import type {
  Project,
  ProjectItemMaster,
  PaginatedQuery,
  PaginationMeta,
} from '../types';
import type {
  ProjectItemImportBatchGroup,
  ProjectItemImportBatchResult,
  ProjectRaciImportBatchGroup,
  ProjectRaciImportBatchResult,
} from '../components/modals/projectImportTypes';

interface UseProjectsReturn {
  projects: Project[];
  projectsPageRows: Project[];
  projectsPageMeta: PaginationMeta;
  projectItems: ProjectItemMaster[];
  isSaving: boolean;
  isLoading: boolean;
  isPageLoading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  loadProjectsPage: (query?: PaginatedQuery) => Promise<void>;
  loadProjectDetail: (projectId: string | number) => Promise<Project | null>;
  loadProjectItems: () => Promise<void>;
  setProjects: Dispatch<SetStateAction<Project[]>>;
  handleSaveProject: (
    data: Partial<Project>,
    modalType: 'ADD_PROJECT' | 'EDIT_PROJECT',
    selectedProject: Project | null
  ) => Promise<boolean>;
  handleDeleteProject: (selectedProject: Project) => Promise<boolean>;
  handleImportProjectItemsBatch: (groups: ProjectItemImportBatchGroup[]) => Promise<ProjectItemImportBatchResult>;
  handleImportProjectRaciBatch: (groups: ProjectRaciImportBatchGroup[]) => Promise<ProjectRaciImportBatchResult>;
  setProjectsPageRows: (rows: Project[]) => void;
  setProjectsPageMeta: (meta: PaginationMeta) => void;
  setProjectItems: Dispatch<SetStateAction<ProjectItemMaster[]>>;
}

interface UseProjectsOptions {
  enabled?: boolean;
}

const resolveCollectionUpdate = <T,>(
  nextValue: SetStateAction<T[]>,
  previousValue: T[],
): T[] => (typeof nextValue === 'function'
  ? (nextValue as (currentValue: T[]) => T[])(previousValue)
  : nextValue);

export function useProjects(
  addToast?: (type: 'success' | 'error', title: string, message: string) => void,
  options: UseProjectsOptions = {},
): UseProjectsReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const [projectsPageRows, setProjectsPageRows] = useState<Project[]>([]);
  const [projectsPageMeta, setProjectsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: fetchProjects,
    enabled,
  });
  const { refetch: refetchProjects } = projectsQuery;

  const projectItemsQuery = useQuery({
    queryKey: queryKeys.projects.items(),
    queryFn: fetchProjectItems,
    enabled,
  });
  const { refetch: refetchProjectItems } = projectItemsQuery;

  const createProjectMutation = useMutation({
    mutationFn: createProject,
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<Project> & Record<string, unknown> }) =>
      updateProject(id, payload),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string | number) => deleteProject(id),
  });

  const projects = projectsQuery.data ?? [];
  const projectItems = projectItemsQuery.data ?? [];

  const loadProjects = useCallback(async () => {
    setError(null);
    try {
      await refetchProjects();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách dự án.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    }
  }, [addToast, refetchProjects]);

  const loadProjectsPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchProjectsPage(query ?? {});
      setProjectsPageRows(result.data || []);
      setProjectsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách dự án.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPageLoading(false);
    }
  }, [addToast]);

  const loadProjectDetail = useCallback(async (projectId: string | number): Promise<Project | null> => {
    setError(null);
    try {
      const detail = await fetchProjectDetail(projectId);
      return detail;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải chi tiết dự án.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
      return null;
    }
  }, [addToast]);

  const loadProjectItems = useCallback(async () => {
    setError(null);
    try {
      await refetchProjectItems();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách hạng mục dự án.';
      setError(message);
    }
  }, [refetchProjectItems]);

  const setProjects: Dispatch<SetStateAction<Project[]>> = useCallback((value) => {
    queryClient.setQueryData<Project[]>(queryKeys.projects.all, (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const setProjectItems: Dispatch<SetStateAction<ProjectItemMaster[]>> = useCallback((value) => {
    queryClient.setQueryData<ProjectItemMaster[]>(queryKeys.projects.items(), (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const handleSaveProject = useCallback(async (
    data: Partial<Project>,
    modalType: 'ADD_PROJECT' | 'EDIT_PROJECT',
    selectedProjectItem: Project | null
  ): Promise<boolean> => {
    setError(null);
    try {
      const normalizeProjectNullableId = (value: unknown): number | null => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      };
      const normalizeProjectNullableText = (value: unknown): string | null => {
        const normalized = String(value ?? '').trim();
        return normalized ? normalized : null;
      };
      const shouldSyncItems = Array.isArray(data.items);
      const shouldSyncRaci = Array.isArray(data.raci);

      const normalizedItems = shouldSyncItems
        ? (data.items || [])
            .map((item) => {
              const source = (item ?? {}) as unknown as Record<string, unknown>;
              const productIdRaw = source.productId ?? source.product_id;
              const productId = Number(productIdRaw);
              if (!Number.isFinite(productId) || productId <= 0) {
                return null;
              }

              const quantityRaw = Number(source.quantity ?? 1);
              const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
              const unitPriceRaw = Number(source.unitPrice ?? source.unit_price ?? 0);
              const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? unitPriceRaw : 0;

              return {
                product_id: productId,
                quantity,
                unit_price: unitPrice,
              };
            })
            .filter((item): item is { product_id: number; quantity: number; unit_price: number } => item !== null)
        : undefined;

      const normalizedRaci = shouldSyncRaci
        ? (data.raci || [])
            .map((item) => {
              const source = (item ?? {}) as unknown as Record<string, unknown>;
              const userIdRaw = source.userId ?? source.user_id;
              const userId = Number(userIdRaw);
              if (!Number.isFinite(userId) || userId <= 0) {
                return null;
              }

              const role = String(source.roleType ?? source.raci_role ?? '')
                .trim()
                .toUpperCase();
              if (!['R', 'A', 'C', 'I'].includes(role)) {
                return null;
              }

              const assignedDateRaw = String(source.assignedDate ?? source.assigned_date ?? '').trim();
              const assignedDate = assignedDateRaw ? normalizeImportDate(assignedDateRaw) : null;

              return {
                user_id: userId,
                raci_role: role,
                ...(assignedDate ? { assigned_date: assignedDate } : {}),
              };
            })
            .filter((item): item is { user_id: number; raci_role: string } => item !== null)
        : undefined;

      const payload: Record<string, unknown> = {
        ...data,
        sync_items: shouldSyncItems,
        sync_raci: shouldSyncRaci,
        items: normalizedItems,
        raci: normalizedRaci,
      };

      if (modalType === 'ADD_PROJECT') {
        const created = await createProjectMutation.mutateAsync(payload as Partial<Project> & Record<string, unknown>);
        queryClient.setQueryData<Project[]>(queryKeys.projects.all, (prev = []) => [
          created,
          ...prev.filter((item) => String(item.id) !== String(created.id)),
        ]);
        addToast?.('success', 'Thành công', 'Thêm mới dự án thành công!');
        void loadProjectItems();
      } else if (modalType === 'EDIT_PROJECT' && selectedProjectItem) {
        const updated = await updateProjectMutation.mutateAsync({
          id: selectedProjectItem.id,
          payload: payload as Partial<Project> & Record<string, unknown>,
        });
        queryClient.setQueryData<Project[]>(queryKeys.projects.all, (prev = []) =>
          prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
        addToast?.('success', 'Thành công', 'Cập nhật dự án thành công!');
        void loadProjectItems();
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu dự án vào cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, createProjectMutation, loadProjectItems, queryClient, updateProjectMutation]);

  const handleDeleteProject = useCallback(async (selectedProjectItem: Project): Promise<boolean> => {
    setError(null);
    try {
      await deleteProjectMutation.mutateAsync(selectedProjectItem.id);
      queryClient.setQueryData<Project[]>(queryKeys.projects.all, (prev = []) =>
        prev.filter((item) => String(item.id) !== String(selectedProjectItem.id))
      );
      addToast?.('success', 'Thành công', 'Đã xóa dự án.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa dự án trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, deleteProjectMutation, queryClient]);

  const handleImportProjectItemsBatch = useCallback(async (
    groups: ProjectItemImportBatchGroup[]
  ): Promise<ProjectItemImportBatchResult> => {
    const result: ProjectItemImportBatchResult = {
      success_projects: [],
      failed_projects: [],
    };

    if (!Array.isArray(groups) || groups.length === 0) {
      return result;
    }

    const projectByCode = new Map<string, Project>();
    (projects || []).forEach((project) => {
      const token = normalizeImportToken(project.project_code);
      if (!token || projectByCode.has(token)) {
        return;
      }
      projectByCode.set(token, project);
    });

    const existingItemsByProject = new Map<string, Map<string, { product_id: number; quantity: number; unit_price: number }>>();
    (projectItems || []).forEach((item) => {
      const projectId = String(item.project_id || '');
      const productId = Number(item.product_id);
      if (!projectId || !Number.isFinite(productId) || productId <= 0) {
        return;
      }

      const quantityRaw = Number(item.quantity ?? 0);
      const unitPriceRaw = Number(item.unit_price ?? 0);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? unitPriceRaw : 0;

      const byProduct = existingItemsByProject.get(projectId) || new Map<string, { product_id: number; quantity: number; unit_price: number }>();
      byProduct.set(String(productId), {
        product_id: productId,
        quantity,
        unit_price: unitPrice,
      });
      existingItemsByProject.set(projectId, byProduct);
    });

    let hasSuccess = false;

    for (const group of groups) {
      const projectCode = String(group?.project_code || '').trim();
      const projectToken = normalizeImportToken(projectCode);

      if (!projectToken) {
        result.failed_projects.push({
          project_code: projectCode || '(trống)',
          message: 'Thiếu Mã DA trong dữ liệu import.',
        });
        continue;
      }

      const project = projectByCode.get(projectToken);
      if (!project) {
        result.failed_projects.push({
          project_code: projectCode,
          message: 'Không tìm thấy dự án theo Mã DA trong hệ thống.',
        });
        continue;
      }

      const sourceItems = Array.isArray(group.items) ? group.items : [];
      const groupErrors: string[] = [];
      const incomingByProduct = new Map<string, { product_id: number; quantity: number; unit_price: number }>();
      sourceItems.forEach((item, index) => {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);
        const unitPrice = Number(item?.unit_price);

        if (!Number.isFinite(productId) || productId <= 0) {
          groupErrors.push(`Dòng ${index + 1}: sản phẩm không hợp lệ.`);
          return;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          groupErrors.push(`Dòng ${index + 1}: số lượng phải lớn hơn 0.`);
          return;
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          groupErrors.push(`Dòng ${index + 1}: đơn giá phải lớn hơn hoặc bằng 0.`);
          return;
        }

        incomingByProduct.set(String(productId), {
          product_id: productId,
          quantity,
          unit_price: unitPrice,
        });
      });

      if (groupErrors.length > 0) {
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message: groupErrors.slice(0, 2).join(' | '),
        });
        continue;
      }

      const projectIdKey = String(project.id);
      const mergedByProduct = new Map<string, { product_id: number; quantity: number; unit_price: number }>(
        existingItemsByProject.get(projectIdKey) || new Map()
      );
      incomingByProduct.forEach((value, key) => {
        mergedByProduct.set(key, value);
      });

      try {
        await updateProject(project.id, {
          sync_items: true,
          items: Array.from(mergedByProduct.values()),
        } as unknown as Partial<Project> & Record<string, unknown>);

        existingItemsByProject.set(projectIdKey, mergedByProduct);
        result.success_projects.push({
          project_code: project.project_code || projectCode,
          applied_count: incomingByProduct.size,
        });
        hasSuccess = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể cập nhật hạng mục dự án.';
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message,
        });
      }
    }

    if (hasSuccess) {
      await Promise.all([loadProjects(), loadProjectItems()]);
      void loadProjectsPage();
    }

    return result;
  }, [projects, projectItems, addToast, loadProjectItems, loadProjects, loadProjectsPage]);

  const handleImportProjectRaciBatch = useCallback(async (
    groups: ProjectRaciImportBatchGroup[]
  ): Promise<ProjectRaciImportBatchResult> => {
    const result: ProjectRaciImportBatchResult = {
      success_projects: [],
      failed_projects: [],
    };

    if (!Array.isArray(groups) || groups.length === 0) {
      return result;
    }

    const projectByCode = new Map<string, Project>();
    (projects || []).forEach((project) => {
      const token = normalizeImportToken(project.project_code);
      if (!token || projectByCode.has(token)) {
        return;
      }
      projectByCode.set(token, project);
    });

    const projectItemById = new Map<string, ProjectItemMaster>();
    (projectItems || []).forEach((item) => {
      const key = String(item.id ?? '').trim();
      if (!key || projectItemById.has(key)) {
        return;
      }
      projectItemById.set(key, item);
    });

    const candidateProjectIds = groups
      .map((group) => {
        const codeToken = normalizeImportToken(group?.project_code);
        if (!codeToken) {
          return null;
        }
        return projectByCode.get(codeToken)?.id || null;
      })
      .filter((value): value is string | number => value !== null);

    const existingRaciRows = candidateProjectIds.length > 0
      ? await fetchProjectRaciAssignments(candidateProjectIds)
      : [];
    const existingRaciByProject = new Map<string, Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>>();
    (existingRaciRows || []).forEach((row) => {
      const projectId = String(row.project_id || '');
      const userId = Number(row.user_id);
      const role = String(row.raci_role || '').trim().toUpperCase() as 'R' | 'A' | 'C' | 'I';
      if (!projectId || !Number.isFinite(userId) || userId <= 0 || !['R', 'A', 'C', 'I'].includes(role)) {
        return;
      }
      const identity = `${userId}|${role}`;
      const byIdentity = existingRaciByProject.get(projectId) || new Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>();
      if (!byIdentity.has(identity)) {
        byIdentity.set(identity, { user_id: userId, raci_role: role });
      }
      existingRaciByProject.set(projectId, byIdentity);
    });

    let hasSuccess = false;
    for (const group of groups) {
      const projectCode = String(group?.project_code || '').trim();
      const projectToken = normalizeImportToken(projectCode);
      if (!projectToken) {
        result.failed_projects.push({
          project_code: projectCode || '(trống)',
          message: 'Thiếu Mã DA trong dữ liệu import.',
        });
        continue;
      }

      const project = projectByCode.get(projectToken);
      if (!project) {
        result.failed_projects.push({
          project_code: projectCode,
          message: 'Không tìm thấy dự án theo Mã DA trong hệ thống.',
        });
        continue;
      }

      const incomingByIdentity = new Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>();
      const sourceRows = Array.isArray(group.raci) ? group.raci : [];
      const groupErrors: string[] = [];
      sourceRows.forEach((entry, index) => {
        const projectItemId = String(entry?.project_item_id ?? '').trim();
        const userId = Number(entry?.user_id);
        const role = String(entry?.raci_role || '').trim().toUpperCase() as 'R' | 'A' | 'C' | 'I';
        if (!projectItemId) {
          groupErrors.push(`Dòng ${index + 1}: thiếu Mã hạng mục dự án.`);
          return;
        }
        const projectItem = projectItemById.get(projectItemId);
        if (!projectItem) {
          groupErrors.push(`Dòng ${index + 1}: không tìm thấy Mã hạng mục dự án "${projectItemId}" trong hệ thống.`);
          return;
        }
        const importedItemProjectId = String(projectItem.project_id ?? '').trim();
        const importedItemProjectCodeToken = normalizeImportToken(projectItem.project_code);
        const targetProjectId = String(project.id ?? '').trim();
        const targetProjectCodeToken = normalizeImportToken(project.project_code);
        const belongsToProject =
          (importedItemProjectId && targetProjectId && importedItemProjectId === targetProjectId) ||
          (importedItemProjectCodeToken && targetProjectCodeToken && importedItemProjectCodeToken === targetProjectCodeToken);
        if (!belongsToProject) {
          groupErrors.push(
            `Dòng ${index + 1}: Mã hạng mục dự án "${projectItemId}" không thuộc dự án "${project.project_code}".`
          );
          return;
        }
        if (!Number.isFinite(userId) || userId <= 0) {
          groupErrors.push(`Dòng ${index + 1}: nhân sự không hợp lệ.`);
          return;
        }
        if (!['R', 'A', 'C', 'I'].includes(role)) {
          groupErrors.push(`Dòng ${index + 1}: vai trò RACI không hợp lệ.`);
          return;
        }
        incomingByIdentity.set(`${userId}|${role}`, { user_id: userId, raci_role: role });
      });

      if (groupErrors.length > 0) {
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message: groupErrors.slice(0, 2).join(' | '),
        });
        continue;
      }

      const projectIdKey = String(project.id);
      const mergedByIdentity = new Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>(
        existingRaciByProject.get(projectIdKey) || new Map()
      );
      incomingByIdentity.forEach((value, key) => {
        mergedByIdentity.set(key, value);
      });

      try {
        await updateProject(project.id, {
          sync_raci: true,
          raci: Array.from(mergedByIdentity.values()),
        } as unknown as Partial<Project> & Record<string, unknown>);

        existingRaciByProject.set(projectIdKey, mergedByIdentity);
        result.success_projects.push({
          project_code: project.project_code || projectCode,
          applied_count: incomingByIdentity.size,
        });
        hasSuccess = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể cập nhật đội ngũ dự án.';
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message,
        });
      }
    }

    if (hasSuccess) {
      await Promise.all([loadProjects(), loadProjectItems()]);
      void loadProjectsPage();
    }

    return result;
  }, [projects, projectItems, addToast, loadProjectItems, loadProjects, loadProjectsPage]);

  return {
    projects: projectsQuery.data ?? [],
    projectsPageRows,
    projectsPageMeta,
    projectItems: projectItemsQuery.data ?? [],
    isSaving:
      createProjectMutation.isPending
      || updateProjectMutation.isPending
      || deleteProjectMutation.isPending,
    isLoading:
      projectsQuery.isLoading
      || projectsQuery.isFetching
      || projectItemsQuery.isLoading
      || projectItemsQuery.isFetching,
    isPageLoading,
    error:
      error
      || (projectsQuery.error instanceof Error ? projectsQuery.error.message : null)
      || (projectItemsQuery.error instanceof Error ? projectItemsQuery.error.message : null),
    loadProjects,
    loadProjectsPage,
    loadProjectDetail,
    loadProjectItems,
    setProjects,
    handleSaveProject,
    handleDeleteProject,
    handleImportProjectItemsBatch,
    handleImportProjectRaciBatch,
    setProjectsPageRows,
    setProjectsPageMeta,
    setProjectItems,
  };
}

/**
 * Normalizes a string token for comparison.
 */
function normalizeImportToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Normalizes an import date string to ISO format (YYYY-MM-DD).
 */
function normalizeImportDate(value: string): string | null {
  const text = String(value || '').trim();
  if (!text) return null;

  const isoPrefixMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefixMatch) {
    const year = Number(isoPrefixMatch[1]);
    const month = Number(isoPrefixMatch[2]);
    const day = Number(isoPrefixMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return text;
    }
    return null;
  }

  const dmyMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + numeric * 86400000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (year >= 1900 && year <= 9999) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}
