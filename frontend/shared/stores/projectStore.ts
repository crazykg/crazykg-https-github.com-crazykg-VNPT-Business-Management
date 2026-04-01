import { create } from 'zustand';
import { DEFAULT_PAGINATION_META } from '../../services/api/_infra';
import {
  createProject,
  deleteProject,
  fetchProjects,
  fetchProjectsPage,
  fetchProjectItems,
  updateProject,
} from '../../services/api/projectApi';
import { isRequestCanceledError } from '../../services/v5Api';
import { FILTER_DEFAULTS, useFilterStore } from './filterStore';
import type {
  Project,
  ProjectItemMaster,
  PaginatedQuery,
  PaginationMeta,
} from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveProjectOptions {
  id?: string | number | null;
  data: Partial<Project> & Record<string, unknown>;
}

interface ProjectStoreState {
  projects: Project[];
  projectsPageRows: Project[];
  projectsPageMeta: PaginationMeta;
  projectItems: ProjectItemMaster[];
  isProjectsLoading: boolean;
  isProjectsPageLoading: boolean;
  isProjectItemsLoading: boolean;
  isSaving: boolean;
  error: string | null;
  notifier: ToastFn | null;

  setNotifier: (notifier: ToastFn | null) => void;
  loadProjects: () => Promise<void>;
  loadProjectsPage: (query?: PaginatedQuery) => Promise<void>;
  handleProjectsPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  loadProjectItems: () => Promise<void>;
  saveProject: (options: SaveProjectOptions) => Promise<Project | null>;
  deleteProject: (projectId: string | number) => Promise<boolean>;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getStoredProjectsQuery = (): PaginatedQuery =>
  useFilterStore.getState().getTabFilter('projectsPage');

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  projectsPageRows: [],
  projectsPageMeta: DEFAULT_PAGINATION_META,
  projectItems: [],
  isProjectsLoading: false,
  isProjectsPageLoading: false,
  isProjectItemsLoading: false,
  isSaving: false,
  error: null,
  notifier: null,

  setNotifier: (notifier) => set({ notifier }),

  loadProjects: async () => {
    set({ isProjectsLoading: true, error: null });
    try {
      const projects = await fetchProjects();
      set({ projects });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = extractErrorMessage(error, 'Không thể tải danh sách dự án.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isProjectsLoading: false });
    }
  },

  loadProjectsPage: async (query?: PaginatedQuery) => {
    const nextQuery = query ?? getStoredProjectsQuery();
    useFilterStore.getState().replaceTabFilter('projectsPage', nextQuery);
    set({ isProjectsPageLoading: true, error: null });
    try {
      const result = await fetchProjectsPage(nextQuery);
      set({
        projectsPageRows: result.data || [],
        projectsPageMeta: result.meta || DEFAULT_PAGINATION_META,
      });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = extractErrorMessage(error, 'Không thể tải danh sách dự án.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isProjectsPageLoading: false });
    }
  },

  handleProjectsPageQueryChange: async (query: PaginatedQuery) => {
    await get().loadProjectsPage(query);
  },

  loadProjectItems: async () => {
    set({ isProjectItemsLoading: true, error: null });
    try {
      const items = await fetchProjectItems();
      set({ projectItems: items || [] });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = extractErrorMessage(error, 'Không thể tải danh sách hạng mục dự án.');
      set({ error: message });
      // Note: swallow error for project items as it's a side-loaded resource
    } finally {
      set({ isProjectItemsLoading: false });
    }
  },

  saveProject: async (options: SaveProjectOptions) => {
    const { id, data } = options;
    set({ isSaving: true, error: null });
    try {
      const saved = id == null
        ? await createProject(data)
        : await updateProject(id, data);

      set((state) => ({
        projects: id == null
          ? [saved, ...state.projects.filter((p) => String(p.id) !== String(saved.id))]
          : state.projects.map((p) => (String(p.id) === String(saved.id) ? saved : p)),
        projectsPageRows: id == null
          ? [saved, ...state.projectsPageRows.filter((p) => String(p.id) !== String(saved.id))]
          : state.projectsPageRows.map((p) => (String(p.id) === String(saved.id) ? saved : p)),
      }));

      // If sync_items or sync_raci was set, reload project items
      if (data.sync_items || data.sync_raci) {
        await get().loadProjectItems();
      }

      const action = id == null ? 'Thêm mới' : 'Cập nhật';
      get().notifier?.('success', 'Thành công', `${action} dự án thành công!`);

      // Reload page to ensure fresh data
      await get().loadProjectsPage();

      return saved;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Lưu thất bại', `Không thể lưu dự án vào cơ sở dữ liệu. ${message}`);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteProject: async (projectId: string | number) => {
    set({ isSaving: true, error: null });
    try {
      await deleteProject(projectId);

      set((state) => ({
        projects: state.projects.filter((p) => String(p.id) !== String(projectId)),
        projectsPageRows: state.projectsPageRows.filter((p) => String(p.id) !== String(projectId)),
      }));

      get().notifier?.('success', 'Thành công', 'Đã xóa dự án.');

      // Reload page to update pagination
      await get().loadProjectsPage();

      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Xóa thất bại', `Không thể xóa dự án trên cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
}));
