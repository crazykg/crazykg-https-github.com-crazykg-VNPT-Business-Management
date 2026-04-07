import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { useProjectStore } from '../shared/stores/projectStore';
import { useFilterStore } from '../shared/stores/filterStore';
import type { Project, ProjectItemMaster, PaginatedQuery, PaginationMeta } from '../types';

const fetchProjectsMock = vi.hoisted(() => vi.fn());
const fetchProjectsPageMock = vi.hoisted(() => vi.fn());
const fetchProjectItemsMock = vi.hoisted(() => vi.fn());
const createProjectMock = vi.hoisted(() => vi.fn());
const updateProjectMock = vi.hoisted(() => vi.fn());
const deleteProjectApiMock = vi.hoisted(() => vi.fn());
const isRequestCanceledErrorMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('../services/api/projectApi', () => ({
  fetchProjects: fetchProjectsMock,
  fetchProjectsPage: fetchProjectsPageMock,
  fetchProjectItems: fetchProjectItemsMock,
  createProject: createProjectMock,
  updateProject: updateProjectMock,
  deleteProject: deleteProjectApiMock,
}));

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');
  return {
    ...actual,
    isRequestCanceledError: isRequestCanceledErrorMock,
  };
});

const buildMeta = (overrides: Partial<PaginationMeta> = {}): PaginationMeta => ({
  ...DEFAULT_PAGINATION_META,
  ...overrides,
});

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  project_code: 'DA-001',
  project_name: 'Dự án HIS',
  customer_id: 10,
  implementation_user_id: 5,
  start_date: '2026-03-01',
  expected_end_date: '2026-12-31',
  status: 'CHUAN_BI',
  investment_mode: 'DAU_TU',
  ...overrides,
});

const buildProjectItem = (overrides: Partial<ProjectItemMaster> = {}): ProjectItemMaster => ({
  id: 1,
  project_id: 1,
  product_id: 100,
  quantity: 5,
  unit_price: 1000000,
  display_name: 'Server',
  created_at: '2026-03-01 00:00:00',
  updated_at: '2026-03-31 00:00:00',
  ...overrides,
});

const resetProjectStore = () => {
  useProjectStore.setState({
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
  });
};

describe('projectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProjectStore();
    useFilterStore.getState().resetTabFilter('projectsPage');
  });

  it('loads paginated projects and persists the latest filter query', async () => {
    const pageQuery: PaginatedQuery = {
      page: 1,
      per_page: 20,
      q: 'HIS',
      sort_by: 'project_code',
      sort_dir: 'asc',
    };
    const rows = [buildProject({ id: 2, project_name: 'Dự án ERP' })];

    fetchProjectsPageMock.mockResolvedValue({
      data: rows,
      meta: buildMeta({ page: 1, per_page: 20, total: 5, total_pages: 1 }),
    });

    await act(async () => {
      await useProjectStore.getState().loadProjectsPage(pageQuery);
    });

    expect(fetchProjectsPageMock).toHaveBeenCalledWith(pageQuery);
    expect(useProjectStore.getState().projectsPageRows).toEqual(rows);
    expect(useProjectStore.getState().projectsPageMeta.total).toBe(5);

    const storedFilter = useFilterStore.getState().getTabFilter('projectsPage');
    expect(storedFilter.page).toBe(pageQuery.page);
    expect(storedFilter.per_page).toBe(pageQuery.per_page);
    expect(storedFilter.q).toBe(pageQuery.q);
  });

  it('loads project items as sub-state', async () => {
    const items = [
      buildProjectItem({ id: 1, project_id: 1 }),
      buildProjectItem({ id: 2, project_id: 1, product_id: 200 }),
    ];

    fetchProjectItemsMock.mockResolvedValue(items);

    await act(async () => {
      await useProjectStore.getState().loadProjectItems();
    });

    expect(fetchProjectItemsMock).toHaveBeenCalled();
    expect(useProjectStore.getState().projectItems).toEqual(items);
  });

  it('creates a new project and reloads items', async () => {
    const notifier = vi.fn();
    const newProject = buildProject({ id: 10, project_name: 'Dự án Mới' });
    const items = [buildProjectItem({ project_id: 10 })];

    useProjectStore.getState().setNotifier(notifier);
    createProjectMock.mockResolvedValue(newProject);
    fetchProjectsPageMock.mockResolvedValue({
      data: [newProject],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });
    fetchProjectItemsMock.mockResolvedValue(items);

    await act(async () => {
      await useProjectStore.getState().saveProject({
        data: {
          project_code: newProject.project_code,
          project_name: newProject.project_name,
          customer_id: newProject.customer_id,
        },
        syncItems: true,
      });
    });

    expect(createProjectMock).toHaveBeenCalledWith(expect.objectContaining({
      project_code: newProject.project_code,
      sync_items: true,
      sync_raci: true,
    }));
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Tạo mới dự án thành công.'
    );

    expect(fetchProjectItemsMock).toHaveBeenCalled();
    expect(useProjectStore.getState().projectItems).toEqual(items);
  });

  it('allows overriding sync flags while still refreshing project items', async () => {
    const notifier = vi.fn();
    const newProject = buildProject({ id: 11 });
    const items = [buildProjectItem({ project_id: 11 })];

    useProjectStore.getState().setNotifier(notifier);
    createProjectMock.mockResolvedValue(newProject);
    fetchProjectsPageMock.mockResolvedValue({
      data: [newProject],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });
    fetchProjectItemsMock.mockResolvedValue(items);

    await act(async () => {
      await useProjectStore.getState().saveProject({
        data: {
          project_code: newProject.project_code,
          project_name: newProject.project_name,
        },
        syncItems: false,
        syncRaci: false,
      });
    });

    expect(createProjectMock).toHaveBeenCalledWith(expect.objectContaining({
      sync_items: false,
      sync_raci: false,
    }));
    expect(fetchProjectItemsMock).toHaveBeenCalled();
    expect(useProjectStore.getState().projectItems).toEqual(items);
  });

  it('updates an existing project with sync_items', async () => {
    const notifier = vi.fn();
    const existingProject = buildProject({ id: 5 });
    const updatedProject = buildProject({ id: 5, project_name: 'Dự án Cập nhật' });
    const items = [buildProjectItem({ project_id: 5 })];

    useProjectStore.getState().setNotifier(notifier);
    useProjectStore.setState({
      projects: [existingProject],
      projectsPageRows: [existingProject],
    });

    updateProjectMock.mockResolvedValue(updatedProject);
    fetchProjectsPageMock.mockResolvedValue({
      data: [updatedProject],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });
    fetchProjectItemsMock.mockResolvedValue(items);

    await act(async () => {
      await useProjectStore.getState().saveProject({
        id: 5,
        data: {
          project_name: updatedProject.project_name,
        },
        syncItems: true,
      });
    });

    expect(updateProjectMock).toHaveBeenCalledWith(5, expect.objectContaining({
      project_name: updatedProject.project_name,
      sync_items: true,
      sync_raci: true,
    }));
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Cập nhật dự án thành công.'
    );
    expect(useProjectStore.getState().projectItems).toEqual(items);
  });

  it('deletes a project and reloads page', async () => {
    const notifier = vi.fn();
    const project = buildProject({ id: 7 });

    useProjectStore.getState().setNotifier(notifier);
    useProjectStore.setState({
      projects: [project],
      projectsPageRows: [project],
    });
    deleteProjectApiMock.mockResolvedValue(undefined);
    fetchProjectsPageMock.mockResolvedValue({
      data: [],
      meta: buildMeta({ total: 0, total_pages: 1 }),
    });

    const result = await act(async () => {
      return await useProjectStore.getState().deleteProject(7);
    });

    expect(result).toBe(true);
    expect(deleteProjectApiMock).toHaveBeenCalledWith(7);
    expect(notifier).toHaveBeenCalledWith('success', 'Thành công', 'Xóa dự án thành công.');
    expect(useProjectStore.getState().projectsPageRows).not.toContain(project);
  });

  it('handles delete error gracefully', async () => {
    const notifier = vi.fn();
    const deleteError = new Error('Delete failed');

    useProjectStore.getState().setNotifier(notifier);
    deleteProjectApiMock.mockRejectedValue(deleteError);

    const result = await act(async () => {
      return await useProjectStore.getState().deleteProject(99);
    });

    expect(result).toBe(false);
    expect(useProjectStore.getState().error).toBe('Delete failed');
    expect(notifier).toHaveBeenCalledWith('error', 'Xóa thất bại', 'Delete failed');
  });

  it('loads full project list', async () => {
    const projects = [
      buildProject({ id: 1 }),
      buildProject({ id: 2, project_name: 'Dự án 2' }),
    ];
    fetchProjectsMock.mockResolvedValue(projects);

    await act(async () => {
      await useProjectStore.getState().loadProjects();
    });

    expect(fetchProjectsMock).toHaveBeenCalled();
    expect(useProjectStore.getState().projects).toEqual(projects);
  });

  it('handles page query change through handler', async () => {
    const pageQuery: PaginatedQuery = {
      page: 2,
      per_page: 10,
      q: 'test',
      sort_by: 'project_name',
      sort_dir: 'desc',
    };
    const rows = [buildProject()];

    fetchProjectsPageMock.mockResolvedValue({
      data: rows,
      meta: buildMeta({ page: 2, per_page: 10, total: 15, total_pages: 2 }),
    });

    await act(async () => {
      await useProjectStore.getState().handleProjectsPageQueryChange(pageQuery);
    });

    expect(fetchProjectsPageMock).toHaveBeenCalledWith(pageQuery);
    expect(useProjectStore.getState().projectsPageMeta.page).toBe(2);
  });

  it('swallows project items load errors gracefully', async () => {
    const itemsError = new Error('Items load failed');
    fetchProjectItemsMock.mockRejectedValue(itemsError);

    await act(async () => {
      await useProjectStore.getState().loadProjectItems();
    });

    // Error should be set but not toast should be called (swallowed)
    expect(useProjectStore.getState().error).toBe('Items load failed');
    expect(useProjectStore.getState().projectItems).toEqual([]);
  });
});
