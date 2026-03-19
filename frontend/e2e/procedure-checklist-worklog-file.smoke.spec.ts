import { expect, test } from '@playwright/test';
import { buildProcedureScenarioState } from './helpers/procedure-fixtures';
import { openProcedureModal } from './helpers/procedure-page';

test.describe('Project procedure checklist, worklog and file smoke', () => {
  test('saves checklist draft changes including document info', async ({ page }) => {
    const state = buildProcedureScenarioState();
    await openProcedureModal(page, state);

    await page.getByTestId('step-progress-1001').selectOption('HOAN_THANH');
    await page.getByTestId('step-start-date-1001').fill('2026-03-20');

    await page.getByTestId('step-file-trigger-1001').click();
    await expect(page.getByTestId('step-file-panel-1001')).toBeVisible();
    await page.getByTestId('step-document-number-1001').fill('QD-2026/01');
    await page.getByTestId('step-document-date-1001').fill('2026-03-21');

    const saveButton = page.getByTestId('procedure-save');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(saveButton).toBeDisabled();
    await expect(page.getByTestId('step-progress-1001')).toHaveValue('HOAN_THANH');
    await expect(page.getByTestId('step-start-date-1001')).toHaveValue('2026-03-20');
    await expect(page.getByTestId('step-file-trigger-1001')).toContainText('QD-2026/01');
  });

  test('adds a worklog entry inside the step panel', async ({ page }) => {
    const state = buildProcedureScenarioState();
    await openProcedureModal(page, state);

    await page.getByTestId('step-worklog-trigger-1001').click();
    await expect(page.getByTestId('step-worklog-panel-1001')).toBeVisible();

    await page.getByTestId('step-worklog-input-1001').fill('Da kiem tra ho so phap ly');
    await page.getByTestId('step-worklog-hours-1001').fill('2.5');
    await page.getByTestId('step-worklog-add-1001').click();

    await expect(page.getByTestId('step-worklog-trigger-1001')).toContainText('Worklog(1)');
    await expect(page.getByText('Da kiem tra ho so phap ly')).toBeVisible();
    await expect(page.getByText('2.50h')).toBeVisible();
  });

  test('shows the file panel and keeps it exclusive with the worklog panel', async ({ page }) => {
    const state = buildProcedureScenarioState();
    state.steps = state.steps.map((step) =>
      step.id === 1001
        ? {
            ...step,
            document_number: '20/QD',
            document_date: '2026-03-10',
          }
        : step,
    );
    state.stepAttachments['1001'] = [
      {
        id: 1,
        fileName: 'quyet-dinh-phe-duyet.pdf',
        fileUrl: 'https://example.com/quyet-dinh-phe-duyet.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        driveFileId: null,
        storageDisk: 'backblaze_b2',
        storagePath: 'procedures/1.pdf',
        storageVisibility: 'private',
        createdAt: '2026-03-19T08:00:00.000Z',
        createdBy: 1,
        createdByName: 'Smoke Tester',
      },
    ];

    await openProcedureModal(page, state);

    await page.getByTestId('step-file-trigger-1001').click();
    await expect(page.getByTestId('step-file-panel-1001')).toBeVisible();
    await expect(page.getByTestId('step-document-number-1001')).toHaveValue('20/QD');
    await expect(page.getByRole('link', { name: 'quyet-dinh-phe-duyet.pdf' })).toBeVisible();
    await expect(page.getByTestId('step-worklog-panel-1001')).toHaveCount(0);

    await page.getByTestId('step-worklog-trigger-1001').click();
    await expect(page.getByTestId('step-worklog-panel-1001')).toBeVisible();
    await expect(page.getByTestId('step-file-panel-1001')).toHaveCount(0);

    await page.getByTestId('step-file-trigger-1001').click();
    await expect(page.getByTestId('step-file-panel-1001')).toBeVisible();
    await expect(page.getByTestId('step-worklog-panel-1001')).toHaveCount(0);
  });
});
