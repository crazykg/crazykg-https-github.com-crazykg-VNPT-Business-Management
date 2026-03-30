import { expect, type Locator, type Page } from '@playwright/test';
import { buildCustomerRequestScenarioState } from './customer-request-fixtures';
import { registerCustomerRequestScenarioMock } from './customer-request-api-mock';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function openCustomerRequestModule(page: Page) {
  const state = buildCustomerRequestScenarioState();
  await registerCustomerRequestScenarioMock(page, state);
  await page.goto('/?tab=customer_request_management');
  await expect(page.getByRole('heading', { name: 'Quản lý yêu cầu khách hàng' }).first()).toBeVisible();
  await page.getByRole('button', { name: /Danh sách/i }).first().click();
  await expect(page.locator('input[placeholder*="Tìm mã YC"], input[placeholder*="Tìm YC tôi"], input[placeholder*="Tìm việc tôi"]').first()).toBeVisible();
  return state;
}

export async function openRequestByCode(page: Page, requestCode: string): Promise<void> {
  const codePattern = new RegExp(requestCode, 'i');
  const buttonTrigger = page.getByRole('button', { name: codePattern }).first();
  if (await buttonTrigger.count()) {
    await buttonTrigger.click();
  } else {
    const rowTrigger = page.locator('tr').filter({ hasText: requestCode }).first();
    if (await rowTrigger.count()) {
      await rowTrigger.click();
    } else {
      await page.getByText(codePattern).first().click();
    }
  }

  const detailSurface = page.getByRole('dialog').last();
  if (await detailSurface.count()) {
    await expect(detailSurface.getByText(codePattern).first()).toBeVisible();
  } else {
    await expect(page.getByText(codePattern).first()).toBeVisible();
  }
}

export function fieldContainerByLabel(page: Page, label: string): Locator {
  const labelMatcher = new RegExp(`^${escapeRegex(label)}`);
  return page
    .locator('label:visible')
    .filter({ hasText: labelMatcher })
    .first()
    .locator('xpath=ancestor::div[.//input or .//textarea or .//select or .//button[@aria-haspopup="listbox"]][1]');
}

export async function fillTextFieldByLabel(page: Page, label: string, value: string): Promise<void> {
  const container = fieldContainerByLabel(page, label);
  const input = container.locator('input,textarea').first();
  await input.fill(value);
}

export async function selectSearchableOptionByLabel(
  page: Page,
  label: string,
  searchTerm: string,
  optionName: string | RegExp,
): Promise<void> {
  const directTrigger = page.locator(`button[aria-haspopup="listbox"][aria-label="${label}"]`).last();
  if (await directTrigger.count()) {
    await directTrigger.click();
  } else {
    const container = fieldContainerByLabel(page, label);
    await container.locator('button[aria-haspopup="listbox"]').first().click();
  }
  await page.locator('input[aria-label^="Tìm "], input[placeholder*="Tìm"]').last().fill(searchTerm);
  await page.getByRole('button', { name: optionName }).last().click();
}
