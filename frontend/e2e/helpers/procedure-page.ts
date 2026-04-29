import { expect, type Page } from '@playwright/test';
import {
  PROCEDURE_TEST_LOGIN,
  type MockProcedureScenarioState,
} from './procedure-fixtures';
import { registerProcedureScenarioMock } from './procedure-api-mock';

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

export async function openProcedureModal(
  page: Page,
  state: MockProcedureScenarioState,
): Promise<void> {
  const projectId = Number(state.project.id);
  const firstParentStep = state.steps.find((step) => step.parent_step_id === null);

  await registerProcedureScenarioMock(page, state);
  await page.goto('/?tab=projects');
  await page.locator('input[autocomplete="username"]').fill(PROCEDURE_TEST_LOGIN.username);
  await page.locator('input[autocomplete="current-password"]').fill(PROCEDURE_TEST_LOGIN.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  const openProcedureButton = getProjectProcedureOpenButton(page, projectId);
  await expect(openProcedureButton).toBeVisible();
  await openProcedureButton.click();
  await expect(page.getByTestId('project-procedure-modal')).toBeVisible();
  if (firstParentStep) {
    await expect(page.getByTestId(`step-progress-${firstParentStep.id}`)).toBeVisible();
  }
}
