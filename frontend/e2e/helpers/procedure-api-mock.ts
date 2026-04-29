import type { Page, Route } from '@playwright/test';
import type {
  MockMember,
  MockProcedureWorklog,
  MockProcedureScenarioState,
  MockStepRaciEntry,
  ProcedureRaciRole,
} from './procedure-fixtures';

const ROLE_ORDER: ProcedureRaciRole[] = ['A', 'R', 'C', 'I'];
const ISO_NOW = '2026-03-19T09:00:00.000Z';

function findMember(state: MockProcedureScenarioState, userId: number): MockMember {
  const member = state.members.find((item) => item.id === userId);
  if (!member) {
    throw new Error(`Unknown member ${userId}`);
  }
  return member;
}

function sortStepRaciRows(rows: MockStepRaciEntry[]): MockStepRaciEntry[] {
  return [...rows].sort((left, right) => {
    if (left.step_id !== right.step_id) {
      return left.step_id - right.step_id;
    }
    const roleDiff = ROLE_ORDER.indexOf(left.raci_role) - ROLE_ORDER.indexOf(right.raci_role);
    if (roleDiff !== 0) {
      return roleDiff;
    }
    return left.user_id - right.user_id;
  });
}

function serializeProcedureRaci(state: MockProcedureScenarioState) {
  return state.procedureRaci.map((entry) => {
    const member = findMember(state, entry.user_id);
    return {
      id: entry.id,
      procedure_id: entry.procedure_id,
      user_id: entry.user_id,
      raci_role: entry.raci_role,
      note: entry.note ?? null,
      full_name: member.full_name,
      user_code: member.user_code,
      username: member.username,
    };
  });
}

function serializeStepRaci(state: MockProcedureScenarioState) {
  return sortStepRaciRows(state.stepRaci).map((entry) => {
    const member = findMember(state, entry.user_id);
    return {
      id: entry.id,
      step_id: entry.step_id,
      user_id: entry.user_id,
      raci_role: entry.raci_role,
      full_name: member.full_name,
      user_code: member.user_code,
      username: member.username,
      created_at: entry.created_at,
    };
  });
}

function resolveOverallProgress(state: MockProcedureScenarioState): number {
  const parentSteps = state.steps.filter((step) => step.parent_step_id === null);
  if (parentSteps.length === 0) {
    return 0;
  }

  const completed = parentSteps.filter((step) => step.progress_status === 'HOAN_THANH').length;
  return Math.round((completed / parentSteps.length) * 100);
}

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function parseJsonBody(route: Route): Record<string, unknown> {
  const raw = route.request().postData();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

export async function registerProcedureScenarioMock(
  page: Page,
  state: MockProcedureScenarioState,
): Promise<void> {
  const projectId = Number(state.project.id);
  const procedureId = Number(state.procedure.id);

  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (method === 'GET' && path === '/api/v5/bootstrap') {
      await fulfillJson(route, { message: 'Unauthenticated.' }, 401);
      return;
    }

    if (method === 'POST' && path === '/api/v5/auth/login') {
      await fulfillJson(route, {
        data: {
          user: state.authUser,
          password_change_required: false,
        },
        password_change_required: false,
      });
      return;
    }

    if (method === 'GET' && path === '/api/v5/projects') {
      if (url.searchParams.has('simple')) {
        await fulfillJson(route, {
          data: [state.project],
          meta: { page: 1, per_page: 10, total: 1, total_pages: 1 },
        });
        return;
      }

      await fulfillJson(route, { data: [state.project] });
      return;
    }

    if (method === 'GET' && path === '/api/v5/project-items') {
      await fulfillJson(route, { data: [] });
      return;
    }

    if (method === 'GET' && path === '/api/v5/project-types') {
      await fulfillJson(route, { data: [state.projectType] });
      return;
    }

    if (method === 'GET' && path === '/api/v5/project-procedure-templates') {
      await fulfillJson(route, { data: [state.template] });
      return;
    }

    if (method === 'GET' && path === `/api/v5/projects/${projectId}/procedures`) {
      await fulfillJson(route, { data: [state.procedure] });
      return;
    }

    if (method === 'GET' && path === `/api/v5/project-procedures/${procedureId}/steps`) {
      await fulfillJson(route, { data: state.steps });
      return;
    }

    if (method === 'PUT' && path === '/api/v5/project-procedure-steps/batch') {
      const body = parseJsonBody(route);
      const updates = Array.isArray(body.steps) ? body.steps : [];

      updates.forEach((row) => {
        const payload = row as Record<string, unknown>;
        const stepId = String(payload.id ?? '');
        state.steps = state.steps.map((step) => {
          if (String(step.id) !== stepId) {
            return step;
          }

          return {
            ...step,
            progress_status: (payload.progress_status as typeof step.progress_status | undefined) ?? step.progress_status,
            document_number: payload.document_number === undefined ? step.document_number : (payload.document_number as string | null),
            document_date: payload.document_date === undefined ? step.document_date : (payload.document_date as string | null),
            duration_days: payload.duration_days === undefined ? step.duration_days : Number(payload.duration_days ?? 0),
            actual_start_date: payload.actual_start_date === undefined ? step.actual_start_date : (payload.actual_start_date as string | null),
            actual_end_date: payload.actual_end_date === undefined ? step.actual_end_date : (payload.actual_end_date as string | null),
          };
        });
      });

      await fulfillJson(route, {
        data: {
          updated_count: updates.length,
          overall_progress: {
            [procedureId]: resolveOverallProgress(state),
          },
        },
      });
      return;
    }

    if (method === 'POST' && path === '/api/v5/project-procedure-steps/reorder') {
      const body = parseJsonBody(route);
      const updates = Array.isArray(body.steps) ? body.steps : [];
      const sortOrderByStepId = new Map(
        updates.map((row) => {
          const payload = row as Record<string, unknown>;
          return [String(payload.id ?? ''), Number(payload.sort_order ?? 0)] as const;
        }),
      );

      state.steps = state.steps.map((step) => {
        const nextSortOrder = sortOrderByStepId.get(String(step.id));
        return nextSortOrder === undefined
          ? step
          : { ...step, sort_order: nextSortOrder };
      });

      await fulfillJson(route, { message: 'Steps reordered.' });
      return;
    }

    if (method === 'GET' && path === `/api/v5/project-procedures/${procedureId}/raci`) {
      await fulfillJson(route, { data: serializeProcedureRaci(state) });
      return;
    }

    if (method === 'GET' && path === `/api/v5/project-procedures/${procedureId}/step-raci`) {
      await fulfillJson(route, { data: serializeStepRaci(state) });
      return;
    }

    if (method === 'GET' && path === '/api/v5/internal-users') {
      await fulfillJson(route, {
        data: state.members.map((member) => ({
          id: member.id,
          user_code: member.user_code,
          username: member.username,
          full_name: member.full_name,
          job_title_raw: 'Nhan vien',
        })),
        meta: {
          page: Number(url.searchParams.get('page') || 1),
          per_page: Number(url.searchParams.get('per_page') || 40),
          total: state.members.length,
          total_pages: 1,
        },
      });
      return;
    }

    const updateSharedIssueStatusMatch = path.match(/^\/api\/v5\/shared-issues\/(\d+)\/status$/);
    if (updateSharedIssueStatusMatch && method === 'PATCH') {
      const issueId = Number(updateSharedIssueStatusMatch[1]);
      const body = parseJsonBody(route);
      const issueStatus = String(body.issue_status || 'JUST_ENCOUNTERED');
      let updatedIssue: Record<string, unknown> | null = null;

      const updateWorklogIssueStatus = (log: MockProcedureWorklog): MockProcedureWorklog => {
        const issue = (log as { issue?: Record<string, unknown> | null }).issue;
        if (!issue || String(issue.id ?? '') !== String(issueId)) {
          return log;
        }

        updatedIssue = { ...issue, issue_status: issueStatus };
        return { ...log, issue: updatedIssue };
      };

      state.procedureWorklogs = state.procedureWorklogs.map(updateWorklogIssueStatus);
      state.stepWorklogs = Object.fromEntries(
        Object.entries(state.stepWorklogs).map(([stepId, logs]) => [
          stepId,
          logs.map(updateWorklogIssueStatus),
        ]),
      );

      if (!updatedIssue) {
        await fulfillJson(route, { message: 'Issue not found.' }, 404);
        return;
      }

      await fulfillJson(route, { data: updatedIssue });
      return;
    }

    const stepRaciMatch = path.match(/^\/api\/v5\/project-procedure-steps\/(\d+)\/raci$/);
    if (stepRaciMatch && method === 'POST') {
      const stepId = Number(stepRaciMatch[1]);
      const body = parseJsonBody(route);
      const userId = Number(body.user_id);
      const raciRole = String(body.raci_role || '') as ProcedureRaciRole;

      if (raciRole === 'A') {
        state.stepRaci = state.stepRaci.filter((entry) => !(entry.step_id === stepId && entry.raci_role === 'A'));
      }

      let existing = state.stepRaci.find(
        (entry) => entry.step_id === stepId && entry.user_id === userId && entry.raci_role === raciRole,
      );

      if (!existing) {
        existing = {
          id: state.nextStepRaciId++,
          step_id: stepId,
          user_id: userId,
          raci_role: raciRole,
          created_at: ISO_NOW,
        };
        state.stepRaci.push(existing);
      }

      const member = findMember(state, existing.user_id);
      await fulfillJson(route, {
        data: {
          id: existing.id,
          step_id: existing.step_id,
          user_id: existing.user_id,
          raci_role: existing.raci_role,
          full_name: member.full_name,
          user_code: member.user_code,
          username: member.username,
          created_at: existing.created_at,
        },
      }, 201);
      return;
    }

    const addWorklogMatch = path.match(/^\/api\/v5\/project-procedure-steps\/(\d+)\/worklogs$/);
    if (addWorklogMatch && method === 'POST') {
      const stepId = Number(addWorklogMatch[1]);
      const body = parseJsonBody(route);
      const sid = String(stepId);
      const hoursSpent = body.hours_spent == null ? null : Number(body.hours_spent);
      const difficulty = String(body.difficulty || '').trim();
      const proposal = String(body.proposal || '').trim();
      const issueStatus = String(body.issue_status || 'JUST_ENCOUNTERED');

      const log = {
        id: state.nextWorklogId++,
        step_id: stepId,
        procedure_id: procedureId,
        log_type: 'NOTE',
        content: String(body.content || ''),
        created_at: ISO_NOW,
        creator: {
          id: state.authUser.id as number,
          full_name: state.authUser.full_name as string,
          user_code: state.authUser.user_code as string,
        },
        step: (() => {
          const step = state.steps.find((item) => item.id === stepId);
          return step
            ? { id: step.id, step_name: step.step_name, step_number: step.step_number }
            : null;
        })(),
        timesheet: hoursSpent && !Number.isNaN(hoursSpent)
          ? { hours_spent: hoursSpent }
          : null,
        issue: difficulty
          ? {
              id: state.nextIssueId++,
              issue_content: difficulty,
              proposal_content: proposal || null,
              issue_status: issueStatus,
            }
          : null,
      };

      state.stepWorklogs[sid] = [log, ...(state.stepWorklogs[sid] ?? [])];
      state.procedureWorklogs = [log, ...state.procedureWorklogs];
      state.steps = state.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              worklogs_count: (step.worklogs_count ?? 0) + 1,
              blocking_worklogs_count: (step.blocking_worklogs_count ?? 0) + 1,
            }
          : step,
      );

      await fulfillJson(route, { data: log }, 201);
      return;
    }

    const deleteStepRaciMatch = path.match(/^\/api\/v5\/project-procedure-step-raci\/(\d+)$/);
    if (deleteStepRaciMatch && method === 'DELETE') {
      const raciId = Number(deleteStepRaciMatch[1]);
      state.stepRaci = state.stepRaci.filter((entry) => entry.id !== raciId);
      await fulfillJson(route, { message: 'Removed' });
      return;
    }

    if (method === 'POST' && path === `/api/v5/project-procedures/${procedureId}/step-raci/batch`) {
      const body = parseJsonBody(route);
      const assignmentsRaw = Array.isArray(body.assignments) ? body.assignments : [];
      const mode = body.mode === 'merge' ? 'merge' : 'overwrite';
      const assignments = assignmentsRaw.map((row) => ({
        step_id: Number((row as Record<string, unknown>).step_id),
        user_id: Number((row as Record<string, unknown>).user_id),
        raci_role: String((row as Record<string, unknown>).raci_role) as ProcedureRaciRole,
      }));

      const targetStepIds = [...new Set(assignments.map((row) => row.step_id))];
      const remainingRows = state.stepRaci.filter((entry) => !targetStepIds.includes(entry.step_id));
      const nextRows: MockStepRaciEntry[] = [];

      targetStepIds.forEach((stepId) => {
        const baseRows = mode === 'merge'
          ? state.stepRaci.filter((entry) => entry.step_id === stepId)
          : [];
        let mergedRows = [...baseRows];

        assignments
          .filter((row) => row.step_id === stepId)
          .forEach((row) => {
            if (row.raci_role === 'A') {
              mergedRows = mergedRows.filter((entry) => entry.raci_role !== 'A');
            }

            const exists = mergedRows.some(
              (entry) => entry.user_id === row.user_id && entry.raci_role === row.raci_role,
            );
            if (!exists) {
              mergedRows.push({
                id: state.nextStepRaciId++,
                step_id: row.step_id,
                user_id: row.user_id,
                raci_role: row.raci_role,
                created_at: ISO_NOW,
              });
            }
          });

        nextRows.push(...mergedRows);
      });

      state.stepRaci = [...remainingRows, ...nextRows];
      await fulfillJson(route, { data: serializeStepRaci(state) });
      return;
    }

    const removeProcedureRaciMatch = path.match(/^\/api\/v5\/project-procedure-raci\/(\d+)$/);
    if (removeProcedureRaciMatch && method === 'DELETE') {
      const raciId = Number(removeProcedureRaciMatch[1]);
      const row = state.procedureRaci.find((entry) => entry.id === raciId) ?? null;
      if (row) {
        state.procedureRaci = state.procedureRaci.filter((entry) => entry.id !== raciId);
        state.stepRaci = state.stepRaci.filter((entry) => entry.user_id !== row.user_id);
      }
      await fulfillJson(route, { message: 'RACI entry removed.' });
      return;
    }

    const stepWorklogsMatch = path.match(/^\/api\/v5\/project-procedure-steps\/(\d+)\/worklogs$/);
    if (stepWorklogsMatch && method === 'GET') {
      const stepId = String(Number(stepWorklogsMatch[1]));
      await fulfillJson(route, { data: state.stepWorklogs[stepId] ?? [] });
      return;
    }

    const stepAttachmentsMatch = path.match(/^\/api\/v5\/project-procedure-steps\/(\d+)\/attachments$/);
    if (stepAttachmentsMatch && method === 'GET') {
      const stepId = String(Number(stepAttachmentsMatch[1]));
      await fulfillJson(route, { data: state.stepAttachments[stepId] ?? [] });
      return;
    }

    if (method === 'GET' && path === `/api/v5/project-procedures/${procedureId}/worklogs`) {
      await fulfillJson(route, { data: state.procedureWorklogs });
      return;
    }

    await fulfillJson(route, {
      message: `Unhandled mock route: ${method} ${path}`,
    }, 500);
  });
}
