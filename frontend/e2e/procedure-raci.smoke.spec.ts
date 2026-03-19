import { expect, test } from '@playwright/test';
import {
  buildProcedureScenarioState,
  PROCEDURE_TEST_PHASE_CODE,
} from './helpers/procedure-fixtures';
import { openProcedureModal } from './helpers/procedure-page';

test.describe('Project procedure RACI smoke', () => {
  test('assigns Accountable quickly from the avatar column', async ({ page }) => {
    const state = buildProcedureScenarioState();
    await openProcedureModal(page, state);

    const trigger = page.getByTestId('step-a-trigger-1001');
    await expect(trigger).toHaveAttribute('title', 'Ha Quang Tuan');

    await trigger.click();
    await page.getByTestId('step-a-option-1001-202').click();

    await expect(trigger).toHaveAttribute('title', 'Phan Vinh Rang');
    await expect(page.getByTestId('step-raci-badge-1001-A-202')).toBeVisible();
    await expect(page.getByTestId('step-raci-badge-1001-A-201')).toHaveCount(0);
  });

  test('toggles step-level R and I assignments from the matrix overlay', async ({ page }) => {
    const state = buildProcedureScenarioState();
    await openProcedureModal(page, state);

    await page.getByTestId(`phase-raci-${PROCEDURE_TEST_PHASE_CODE}`).click();
    await expect(page.getByTestId('raci-matrix-panel')).toBeVisible();

    const rCell = page.getByTestId('raci-cell-1002-202-R');
    const iCell = page.getByTestId('raci-cell-1002-203-I');

    await expect(rCell).toHaveAttribute('aria-pressed', 'false');
    await expect(iCell).toHaveAttribute('aria-pressed', 'true');

    await rCell.click();
    await expect(rCell).toHaveAttribute('aria-pressed', 'true');

    await iCell.click();
    await expect(iCell).toHaveAttribute('aria-pressed', 'false');

    await iCell.click();
    await expect(iCell).toHaveAttribute('aria-pressed', 'true');
  });

  test('copies step RACI in merge and overwrite modes', async ({ page }) => {
    const state = buildProcedureScenarioState();
    await openProcedureModal(page, state);

    await page.getByTestId(`phase-raci-${PROCEDURE_TEST_PHASE_CODE}`).click();
    await expect(page.getByTestId('raci-matrix-panel')).toBeVisible();

    await page.getByTestId('raci-copy-1001').click();
    await page.getByRole('button', { name: 'Bỏ chọn tất cả' }).click();
    await page.getByTestId('raci-copy-target-1002').check();
    await page.getByTestId('raci-copy-mode-merge').check();
    await page.getByTestId('raci-copy-apply').click();

    await expect(page.getByTestId('raci-cell-1002-201-A')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('raci-cell-1002-202-R')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('raci-cell-1002-203-C')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('raci-cell-1002-203-I')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('raci-copy-1001').click();
    await page.getByRole('button', { name: 'Bỏ chọn tất cả' }).click();
    await page.getByTestId('raci-copy-target-1002').check();
    await page.getByTestId('raci-copy-mode-overwrite').check();
    await page.getByTestId('raci-copy-apply').click();

    await expect(page.getByTestId('raci-cell-1002-201-A')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('raci-cell-1002-202-R')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('raci-cell-1002-203-C')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('raci-cell-1002-203-I')).toHaveAttribute('aria-pressed', 'false');
  });

  test('removing a procedure-level member prunes that user from step-level RACI', async ({ page }) => {
    const state = buildProcedureScenarioState();
    await openProcedureModal(page, state);

    const trigger = page.getByTestId('step-a-trigger-1001');
    await expect(trigger).toHaveAttribute('title', 'Ha Quang Tuan');

    await page.getByTestId('procedure-tab-raci').click();
    await expect(page.getByTestId('procedure-raci-remove-9001')).toBeVisible();
    await page.getByTestId('procedure-raci-remove-9001').click();

    await page.getByTestId('procedure-tab-steps').click();
    await expect(trigger).toHaveAttribute('title', 'Chọn người chịu trách nhiệm');
    await expect(page.getByTestId('step-raci-badge-1001-A-201')).toHaveCount(0);

    await page.getByTestId(`phase-raci-${PROCEDURE_TEST_PHASE_CODE}`).click();
    await expect(page.getByTestId('raci-cell-1001-201-A')).toHaveCount(0);
  });
});
