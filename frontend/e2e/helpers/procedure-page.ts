import { expect, type Page } from '@playwright/test';
import {
  PROCEDURE_TEST_LOGIN,
  type MockProcedureScenarioState,
} from './procedure-fixtures';
import { registerProcedureScenarioMock } from './procedure-api-mock';

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
  await expect(page.getByTestId(`project-open-procedure-${projectId}`)).toBeVisible();
  await page.getByTestId(`project-open-procedure-${projectId}`).click();
  await expect(page.getByTestId('project-procedure-modal')).toBeVisible();
  if (firstParentStep) {
    await expect(page.getByTestId(`step-a-trigger-${firstParentStep.id}`)).toBeVisible();
  }
}
