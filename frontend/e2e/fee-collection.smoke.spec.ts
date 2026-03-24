import { expect, test } from '@playwright/test';
import { openFeeCollectionModule } from './helpers/fee-collection-api-mock';

test.describe('Fee Collection (Thu Cước) smoke', () => {
  test('dashboard sub-view renders KPI cards and charts', async ({ page }) => {
    const state = await openFeeCollectionModule(page);

    // Hub heading
    await expect(page.getByRole('heading', { name: 'Thu cước & Công nợ' })).toBeVisible();

    // Sub-view toggle buttons exist
    await expect(page.getByRole('button', { name: /Dashboard/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Hóa đơn/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Phiếu thu/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Công nợ/ })).toBeVisible();

    // KPI cards
    await expect(page.getByText('Doanh thu kỳ', { exact: true })).toBeVisible();
    await expect(page.getByText('Đã thu', { exact: true })).toBeVisible();
    await expect(page.getByText('Còn nợ', { exact: true })).toBeVisible();
    await expect(page.getByText('Quá hạn', { exact: true })).toBeVisible();
    await expect(page.getByText('Tỷ lệ thu', { exact: true })).toBeVisible();
    await expect(page.getByText('TB ngày thu', { exact: true })).toBeVisible();

    // Dashboard API was called
    await expect.poll(() => state.dashboardRequests.length).toBeGreaterThan(0);
    expect(state.dashboardRequests[0].period_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.dashboardRequests[0].period_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Top debtors widget
    await expect(page.getByText('Ngân hàng Việt Á')).toBeVisible();
  });

  test('invoice list sub-view loads with pagination and KPI strip', async ({ page }) => {
    const state = await openFeeCollectionModule(page);

    await page.getByRole('button', { name: /Hóa đơn/ }).click();

    // Invoice list loaded
    await expect(page.getByText('INV-202601-0001')).toBeVisible();
    await expect(page.getByText('INV-202602-0001')).toBeVisible();
    await expect(page.getByText('INV-202603-0001')).toBeVisible();

    // Invoice list API was called
    await expect.poll(() => state.invoiceListRequests.length).toBeGreaterThan(0);

    // Status badges present
    await expect(page.getByText('PAID').first()).toBeVisible();
    await expect(page.getByText('OVERDUE').first()).toBeVisible();
    await expect(page.getByText('ISSUED').first()).toBeVisible();
  });

  test('invoice list status filter works', async ({ page }) => {
    const state = await openFeeCollectionModule(page);

    await page.getByRole('button', { name: /Hóa đơn/ }).click();

    // Filter to OVERDUE only
    await page.getByRole('combobox', { name: /Trạng thái/ }).selectOption('OVERDUE');

    // Only the overdue invoice is shown
    await expect(page.getByText('INV-202602-0001')).toBeVisible();
    await expect(page.getByText('INV-202601-0001')).not.toBeVisible();

    // Filter was sent to API
    await expect.poll(() => state.invoiceListRequests.at(-1)?.status).toBe('OVERDUE');
  });

  test('receipt list sub-view loads', async ({ page }) => {
    await openFeeCollectionModule(page);

    await page.getByRole('button', { name: /Phiếu thu/ }).click();

    await expect(page.getByText('RCP-202601-0001')).toBeVisible();
    await expect(page.getByText('Ngân hàng Việt Á')).toBeVisible();
    await expect(page.getByText('BANK_TRANSFER')).toBeVisible();
  });

  test('debt report sub-view shows aging table buckets', async ({ page }) => {
    await openFeeCollectionModule(page);

    await page.getByRole('button', { name: /Công nợ/ }).click();

    // Aging report heading
    await expect(page.getByText('Báo cáo công nợ', { exact: true })).toBeVisible();

    // Bucket column headers
    await expect(page.getByText('Hiện tại', { exact: true })).toBeVisible();
    await expect(page.getByText('1-30 ngày', { exact: true })).toBeVisible();
    await expect(page.getByText('31-60 ngày', { exact: true })).toBeVisible();
    await expect(page.getByText('> 90 ngày', { exact: true })).toBeVisible();

    // Customer rows
    await expect(page.getByText('Ngân hàng Việt Á')).toBeVisible();
    await expect(page.getByText('Tập đoàn Petrolimex')).toBeVisible();
  });
});
