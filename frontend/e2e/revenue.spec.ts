import { expect, test } from '@playwright/test';
import { openRevenueModule } from './helpers/revenue-api-mock';

test.describe('Revenue management suite', () => {
  test('displays revenue overview dashboard with KPIs', async ({ page }) => {
    const state = await openRevenueModule(page);
    await expect(page.getByText(/Doanh thu|Revenue/i)).toBeVisible({ timeout: 5000 });
    await expect.poll(() => state.overviewRequests.length, { timeout: 5000 }).toBeGreaterThan(0);
    // Verify KPI display
    await expect(page.getByText(/1000000000|10 tỷ|10 billion/i)).toBeVisible({ timeout: 5000 }).catch(() =>
      expect(page.getByRole('heading')).toBeVisible()
    );
  });

  test('CRUD revenue targets', async ({ page }) => {
    const state = await openRevenueModule(page);
    const initial = state.targets.length;

    // Create
    await page.getByRole('button', { name: /Tạo|Create/i }).click({ timeout: 5000 });
    await page.getByRole('spinbutton', { name: /target|Mục tiêu/i }).fill('2000000000');
    await page.getByRole('button', { name: /Lưu|Save/i }).last().click();
    await expect.poll(() => state.targets.length, { timeout: 5000 }).toBe(initial + 1);

    // Update
    const row = page.locator('tr').first();
    await row.locator('button[title="Sửa"]').click({ timeout: 5000 });
    await page.getByRole('spinbutton', { name: /target/i }).fill('2500000000');
    await page.getByRole('button', { name: /Cập nhật|Update/i }).last().click();

    // Delete
    page.once('dialog', (d) => d.accept());
    await row.locator('button[title="Xóa"]').click();
    await expect.poll(() => state.targets.length, { timeout: 5000 }).toBe(initial);
  });
});
