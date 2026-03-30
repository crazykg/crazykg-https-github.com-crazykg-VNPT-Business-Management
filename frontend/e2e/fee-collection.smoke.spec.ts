import { expect, test } from '@playwright/test';
import { openFeeCollectionModule } from './helpers/fee-collection-api-mock';

test.describe('Fee Collection (Thu Cước) smoke', () => {
  test('dashboard sub-view renders KPI cards and charts', async ({ page }) => {
    const state = await openFeeCollectionModule(page);

    // Hub heading
    await expect(page.getByRole('heading', { name: 'Thu cước & Công nợ' })).toBeVisible();

    // Sub-view toggle buttons exist
    await expect(page.getByRole('button', { name: /Tổng quan/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Hóa đơn/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Phiếu thu/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Báo cáo công nợ/ })).toBeVisible();

    // KPI cards
    await expect(page.getByText('Doanh thu kỳ', { exact: true })).toBeVisible();
    await expect(page.getByText('Đã thu', { exact: true })).toBeVisible();
    await expect(page.getByText('Còn nợ', { exact: true })).toBeVisible();
    await expect(page.getByText('Quá hạn', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Tỷ lệ thu', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('TB ngày thu', { exact: true }).first()).toBeVisible();

    // Dashboard API was called
    await expect.poll(() => state.dashboardRequests.length).toBeGreaterThan(0);
    expect(state.dashboardRequests[0].period_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.dashboardRequests[0].period_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Top debtors widget
    await expect(page.getByText('Ngân hàng Việt Á').first()).toBeVisible();
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
    await expect(page.getByRole('cell', { name: 'Đã thanh toán' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'OVERDUE' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Đã phát hành' })).toBeVisible();
  });

  test('invoice list status filter works', async ({ page }) => {
    const state = await openFeeCollectionModule(page);

    await page.getByRole('button', { name: /Hóa đơn/ }).click();

    // Filter to PAID only. OVERDUE is a computed badge and not part of the persisted status select.
    await page.locator('select').first().selectOption('PAID');

    // Only the paid invoice is shown
    await expect(page.getByText('INV-202601-0001')).toBeVisible();
    await expect(page.getByText('INV-202602-0001')).not.toBeVisible();

    // Filter was sent to API
    await expect.poll(() => state.invoiceListRequests.at(-1)?.status).toBe('PAID');
  });

  test('receipt list sub-view loads', async ({ page }) => {
    await openFeeCollectionModule(page);

    await page.getByRole('button', { name: /Phiếu thu/ }).click();

    await expect(page.getByText('RCP-202601-0001')).toBeVisible();
    await expect(page.getByText('Ngân hàng Việt Á')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Chuyển khoản' })).toBeVisible();
  });

  test('debt report sub-view shows aging table buckets', async ({ page }) => {
    await openFeeCollectionModule(page);

    await page.getByRole('button', { name: /Báo cáo công nợ/ }).click();

    // Aging report heading
    await expect(page.getByText('Báo cáo công nợ', { exact: true })).toBeVisible();

    // Bucket column headers
    await expect(page.getByRole('columnheader', { name: 'Hiện tại' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '1-30 ngày' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '31-60 ngày' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '>90 ngày' })).toBeVisible();

    // Customer rows
    await expect(page.getByText('Ngân hàng Việt Á')).toBeVisible();
    await expect(page.getByText('Tập đoàn Petrolimex')).toBeVisible();
  });
});
