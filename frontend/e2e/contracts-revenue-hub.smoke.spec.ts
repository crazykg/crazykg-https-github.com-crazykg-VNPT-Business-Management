import { expect, test } from '@playwright/test';
import { openContractRevenueModule } from './helpers/contract-revenue-api-mock';

test.describe('Contracts revenue hub smoke', () => {
  test('switches to revenue view, changes grouping, and drills down by contract item', async ({ page }) => {
    const state = await openContractRevenueModule(page);

    const moduleHeader = page.locator('header').filter({
      has: page.getByRole('heading', { name: 'Hợp đồng & Doanh thu' }),
    });

    await expect(page.getByRole('heading', { name: 'Hợp đồng & Doanh thu' })).toBeVisible();
    await expect(moduleHeader.getByRole('button', { name: /Hợp đồng/ })).toBeVisible();
    await moduleHeader.getByRole('button', { name: /Doanh thu/ }).click();

    await expect(page.getByRole('heading', { name: 'Phân tích doanh thu hợp đồng' })).toBeVisible();
    await expect(page.getByText('Doanh thu dự kiến', { exact: true })).toBeVisible();
    await expect(page.getByText('Dự kiến vs thực thu', { exact: true })).toBeVisible();
    await expect(page.getByText('Doanh thu theo chu kỳ thanh toán', { exact: true })).toBeVisible();
    await expect(page.getByText('Doanh thu theo hợp đồng', { exact: true })).toBeVisible();
    await expect(page.getByText('Chi tiết đợt thanh toán quá hạn', { exact: true })).toBeVisible();
    await expect(page.getByText('HD-DT-001')).toBeVisible();

    await expect.poll(() => state.analyticsRequests.length).toBeGreaterThan(0);
    expect(state.analyticsRequests[0]).toMatchObject({
      grouping: 'month',
      contract_id: null,
    });
    expect(state.analyticsRequests[0].period_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.analyticsRequests[0].period_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.getByRole('button', { name: 'Theo quý' }).click();
    await expect.poll(() => state.analyticsRequests.at(-1)?.grouping).toBe('quarter');
    await expect(page.getByText('Q1/2026').first()).toBeVisible();

    const contractRow = page.locator('tr').filter({ has: page.getByText('HD-DT-001') }).first();
    await contractRow.getByRole('button').click();

    await expect.poll(() => state.analyticsRequests.at(-1)?.contract_id).toBe(101);
    await expect(page.getByText('Phần mềm VNPT HIS L3')).toBeVisible();
    await expect(page.getByText('Dịch vụ giám sát SOC')).toBeVisible();
    await expect(page.getByText('License')).toBeVisible();
    await expect(page.getByText('Gói')).toBeVisible();
  });
});
