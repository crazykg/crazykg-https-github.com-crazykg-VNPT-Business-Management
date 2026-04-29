import { expect, test, type Page } from '@playwright/test';
import {
  buildProcedureScenarioState,
  PROCEDURE_TEST_LOGIN,
  type MockProcedureScenarioState,
  type MockStep,
} from './helpers/procedure-fixtures';
import { registerProcedureScenarioMock } from './helpers/procedure-api-mock';

function getProjectProcedureOpenButton(page: Page, projectId: number) {
  return page
    .locator(
      [
        `[data-testid="project-open-procedure-${projectId}"]`,
        `[data-testid="project-mobile-open-procedure-${projectId}"]`,
      ].join(', '),
    )
    .first();
}

async function openProcedureModalForReorder(
  page: Page,
  state: MockProcedureScenarioState,
): Promise<void> {
  const projectId = Number(state.project.id);

  await registerProcedureScenarioMock(page, state);
  await page.goto('/?tab=projects');
  await page.locator('input[autocomplete="username"]').fill(PROCEDURE_TEST_LOGIN.username);
  await page.locator('input[autocomplete="current-password"]').fill(PROCEDURE_TEST_LOGIN.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  const openProcedureButton = getProjectProcedureOpenButton(page, projectId);
  await expect(openProcedureButton).toBeVisible();
  await openProcedureButton.click();
  await expect(page.getByTestId('project-procedure-modal')).toBeVisible();
}

async function reopenProcedureModal(page: Page, state: MockProcedureScenarioState): Promise<void> {
  const projectId = Number(state.project.id);

  await page.getByRole('button', { name: 'Đóng modal thủ tục' }).click();
  await expect(page.getByTestId('project-procedure-modal')).toHaveCount(0);
  await getProjectProcedureOpenButton(page, projectId).click();
  await expect(page.getByTestId('project-procedure-modal')).toBeVisible();
}

async function expectVisibleStepOrder(page: Page, expectedIds: string[]): Promise<void> {
  await expect
    .poll(async () =>
      page.locator('[data-testid^="step-row-"]').evaluateAll((rows) =>
        rows.map((row) => String(row.getAttribute('data-testid') || '').replace('step-row-', '')),
      ),
    )
    .toEqual(expectedIds);
}

async function expectStepDisplayNumbers(page: Page, expected: Record<string, string>): Promise<void> {
  for (const [stepId, number] of Object.entries(expected)) {
    await expect(page.getByTestId(`step-display-number-${stepId}`)).toHaveText(number);
  }
}

function makeStep(base: MockStep, overrides: Partial<MockStep>): MockStep {
  return {
    ...base,
    template_step_id: null,
    step_detail: null,
    support_unit: null,
    document_number: null,
    document_date: null,
    actual_start_date: null,
    actual_end_date: null,
    step_notes: null,
    created_by: null,
    updated_by: null,
    worklogs_count: 0,
    blocking_worklogs_count: 0,
    ...overrides,
  };
}

function addReorderChildren(state: MockProcedureScenarioState): void {
  const base = state.steps[0];
  state.steps = state.steps.map((step) => {
    if (step.id === 1001) return { ...step, sort_order: 10 };
    if (step.id === 1002) return { ...step, sort_order: 40 };
    if (step.id === 1003) return { ...step, sort_order: 60 };
    return step;
  });
  state.steps.push(
    makeStep(base, {
      id: 1101,
      step_number: 11,
      parent_step_id: 1001,
      step_name: 'Lap may chu dung thu',
      sort_order: 20,
    }),
    makeStep(base, {
      id: 1102,
      step_number: 12,
      parent_step_id: 1001,
      step_name: 'Cau hinh dich vu dung thu',
      sort_order: 30,
    }),
    makeStep(base, {
      id: 1201,
      step_number: 21,
      parent_step_id: 1002,
      step_name: 'Kiem tra ho so tham dinh',
      sort_order: 50,
    }),
  );
}

function addCompletedInfrastructurePhase(state: MockProcedureScenarioState): void {
  const base = state.steps[0];
  state.steps.push(
    makeStep(base, {
      id: 2001,
      step_number: 20,
      parent_step_id: null,
      phase: 'HA_TANG_DUNG_THU',
      phase_label: 'Cai dat ha tang dung thu',
      step_name: 'Cai dat ha tang dung thu',
      progress_status: 'HOAN_THANH',
      sort_order: 100,
    }),
    makeStep(base, {
      id: 2101,
      step_number: 21,
      parent_step_id: 2001,
      phase: 'HA_TANG_DUNG_THU',
      phase_label: 'Cai dat ha tang dung thu',
      step_name: 'Kiem tra ket noi dung thu',
      progress_status: 'HOAN_THANH',
      sort_order: 110,
    }),
  );
}

test.describe('Project procedure step reorder', () => {
  test('moves a parent step together with its child block', async ({ page }) => {
    const state = buildProcedureScenarioState();
    addReorderChildren(state);

    await openProcedureModalForReorder(page, state);
    await expectVisibleStepOrder(page, ['1001', '1101', '1102', '1002', '1201', '1003']);
    await expectStepDisplayNumbers(page, {
      '1001': '1',
      '1101': '1.1',
      '1102': '1.2',
      '1002': '2',
      '1201': '2.1',
      '1003': '3',
    });

    await page.getByTestId('step-reorder-down-1001').click();
    await expectVisibleStepOrder(page, ['1002', '1201', '1001', '1101', '1102', '1003']);
    await expectStepDisplayNumbers(page, {
      '1002': '1',
      '1201': '1.1',
      '1001': '2',
      '1101': '2.1',
      '1102': '2.2',
      '1003': '3',
    });

    await reopenProcedureModal(page, state);
    await expectVisibleStepOrder(page, ['1002', '1201', '1001', '1101', '1102', '1003']);
    await expectStepDisplayNumbers(page, {
      '1002': '1',
      '1201': '1.1',
      '1001': '2',
      '1101': '2.1',
      '1102': '2.2',
      '1003': '3',
    });
  });

  test('reorders child steps only inside the same parent', async ({ page }) => {
    const state = buildProcedureScenarioState();
    addReorderChildren(state);

    await openProcedureModalForReorder(page, state);
    await page.getByTestId('step-reorder-up-1102').click();

    await expectVisibleStepOrder(page, ['1001', '1102', '1101', '1002', '1201', '1003']);
    await expectStepDisplayNumbers(page, {
      '1001': '1',
      '1102': '1.1',
      '1101': '1.2',
      '1002': '2',
      '1201': '2.1',
      '1003': '3',
    });
  });

  test('collapses completed phases by default and expands them on demand', async ({ page }) => {
    const state = buildProcedureScenarioState();
    addCompletedInfrastructurePhase(state);

    await openProcedureModalForReorder(page, state);
    const toggle = page.getByTestId('phase-collapse-toggle-HA_TANG_DUNG_THU');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('procedure-phase-body-HA_TANG_DUNG_THU')).toHaveCount(0);
    await expect(page.getByTestId('step-row-2001')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('step-row-2001')).toBeVisible();
    await expect(page.getByTestId('step-row-2101')).toBeVisible();

    await reopenProcedureModal(page, state);
    await expect(page.getByTestId('phase-collapse-toggle-HA_TANG_DUNG_THU')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('step-row-2001')).toHaveCount(0);
  });

  test('keeps completed phase toggle accessible by keyboard on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = buildProcedureScenarioState();
    addCompletedInfrastructurePhase(state);

    await openProcedureModalForReorder(page, state);
    const toggle = page.getByTestId('phase-collapse-toggle-HA_TANG_DUNG_THU');

    await toggle.focus();
    await expect(toggle).toBeFocused();
    const box = await toggle.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('step-row-2001')).toBeVisible();

    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('step-row-2001')).toHaveCount(0);
  });
});
