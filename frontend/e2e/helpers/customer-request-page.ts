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
  await expect(page.getByRole('heading', { name: 'Danh sách yêu cầu' })).toBeVisible();
  return state;
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
  const container = fieldContainerByLabel(page, label);
  await container.locator('button[aria-haspopup="listbox"]').first().click();
  await page.locator('input[aria-label^="Tìm "], input[placeholder*="Tìm"]').last().fill(searchTerm);
  await page.getByRole('button', { name: optionName }).last().click();
}
