import { expect, type Page } from '@playwright/test';
import {
  fillTextFieldByLabel,
  openRequestByCode,
  selectSearchableOptionByLabel,
} from './customer-request-page';

type TransitionOptions = {
  assignee?: {
    label: string;
    searchTerm: string;
    optionName: string | RegExp;
  };
  textFields?: Array<{ label: string; value: string }>;
};

export async function closeTopDialogIfOpen(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dialog = page.getByRole('dialog').last();
    if (!await dialog.count()) {
      return;
    }

    const closeButton = dialog.getByRole('button', { name: /Đóng|close/i }).first();
    if (!await closeButton.count()) {
      return;
    }

    await closeButton.evaluate((node) => {
      (node as HTMLButtonElement).click();
    });
    await page.waitForTimeout(150);
  }
}

export async function switchToRequestListSurface(page: Page): Promise<void> {
  await closeTopDialogIfOpen(page);
  const listSurfaceButton = page.getByRole('button', { name: /table_rows Danh sách/i }).first();
  await listSurfaceButton.evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  await expect(
    page.locator('input[placeholder*="Tìm mã YC"], input[placeholder*="Tìm YC tôi"], input[placeholder*="Tìm việc tôi"]').first(),
  ).toBeVisible();
}

export async function transitionRequest(
  page: Page,
  requestCode: string,
  toStatusCode: string,
  options: TransitionOptions = {},
): Promise<void> {
  await switchToRequestListSurface(page);
  await openRequestByCode(page, requestCode);

  const detailDialog = page.getByRole('dialog').last();
  await detailDialog.locator('select').first().selectOption(toStatusCode);
  await detailDialog.getByRole('button', { name: /(Chuyển|Đánh giá)\s*→/ }).click();

  const transitionDialog = page.getByRole('dialog').last();
  await expect(transitionDialog.getByRole('button', { name: /Xác nhận chuyển trạng thái/i })).toBeVisible();

  if (options.assignee) {
    await selectSearchableOptionByLabel(
      page,
      options.assignee.label,
      options.assignee.searchTerm,
      options.assignee.optionName,
    );
  }

  for (const field of options.textFields ?? []) {
    await fillTextFieldByLabel(page, field.label, field.value);
  }

  await transitionDialog.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
  await page.waitForTimeout(200);
}
