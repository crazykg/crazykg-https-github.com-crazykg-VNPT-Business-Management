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
import { useToastStore } from './toastStore';
import type { Project, ProjectItemMaster, PaginatedQuery, PaginationMeta } from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveProjectOptions {
  id?: string | number | null;
  data: Partial<Project> & Record<string, unknown>;
  syncItems?: boolean;
  syncRaci?: boolean;
}

interface ProjectStoreState {
  // --- state ---
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

  // --- actions ---
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

  loadProjectsPage: async (query) => {
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

  handleProjectsPageQueryChange: async (query) => {
    await get().loadProjectsPage(query);
  },

  loadProjectItems: async () => {
    set({ isProjectItemsLoading: true, error: null });
    try {
      const items = await fetchProjectItems();
      set({ projectItems: items });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = extractErrorMessage(error, 'Không thể tải danh sách công việc dự án.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isProjectItemsLoading: false });
    }
  },

  saveProject: async (options) => {
    const { id, data, syncItems = true, syncRaci = true } = options;
    set({ isSaving: true, error: null });
    try {
      let savedProject: Project;

      // Add sync parameters to payload
      const payload = {
        ...data,
        sync_items: syncItems,
        sync_raci: syncRaci,
      };

      if (id) {
        savedProject = await updateProject(id, payload);
      } else {
        savedProject = await createProject(payload);
      }

      // Cascading refresh: reload both projects and project items
      await Promise.all([get().loadProjectsPage(), get().loadProjectItems()]);

      const action = id ? 'Cập nhật' : 'Tạo mới';
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', `${action} dự án thành công.`);

      return savedProject;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể lưu dự án.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Lưu thất bại', message);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteProject: async (projectId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteProject(projectId);

      // Remove from local state
      set((state) => ({
        projectsPageRows: state.projectsPageRows.filter((p) => String(p.id) !== String(projectId)),
        projects: state.projects.filter((p) => String(p.id) !== String(projectId)),
      }));

      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', 'Xóa dự án thành công.');
      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể xóa dự án.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Xóa thất bại', message);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
}));
