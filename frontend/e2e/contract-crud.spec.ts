import { expect, test } from '@playwright/test';
import { openContractCrudModule } from './helpers/contract-crud-api-mock';

test('contract CRUD operations: create, update, and delete', async ({ page }) => {
  const state = await openContractCrudModule(page);
  const initialCount = state.contracts.length;

  // ========== CREATE ==========
  await page.getByRole('button', { name: /Tạo|Thêm/i }).click();
  await expect(page.getByRole('heading', { name: /tạo|create/i })).toBeVisible({ timeout: 5000 });

  // Fill form
  await page.getByRole('textbox', { name: /tiêu đề|title/i }).fill('Hợp đồng dịch vụ B');
  await page.getByRole('combobox', { name: /khách hàng|customer/i }).click();
  await page.getByText('Công ty XYZ').click();
  await page.getByRole('spinbutton', { name: /giá trị|value/i }).fill('75000000');
  await page.getByRole('textbox', { name: /ngày bắt đầu|start date/i }).fill('2026-02-01');
  await page.getByRole('textbox', { name: /ngày kết thúc|end date/i }).fill('2027-02-01');

  // Submit create
  await page.getByRole('button', { name: /lưu|tạo|save|create/i }).last().click();

  // Verify contract was added to state
  await expect.poll(() => state.contracts.length, { timeout: 5000 }).toBe(initialCount + 1);

  // Find the new contract in the UI
  const newContract = state.contracts[state.contracts.length - 1];
  const contractRow = page
    .locator('tr')
    .filter({ hasText: new RegExp(newContract.contract_code) })
    .first();
  await expect(contractRow).toBeVisible({ timeout: 5000 });

  // ========== UPDATE ==========
  await contractRow.locator('button[title="Sửa"]').click();
  await expect(page.getByRole('heading', { name: /sửa|edit|update/i })).toBeVisible({
    timeout: 5000,
  });

  // Change title
  const titleInput = page.getByRole('textbox', { name: /tiêu đề|title/i }).first();
  await titleInput.clear();
  await titleInput.fill('Hợp đồng dịch vụ B (updated)');

  // Submit update
  await page.getByRole('button', { name: /cập nhật|update|save/i }).last().click();

  // Verify title updated in state
  await expect.poll(
    () => newContract.title,
    { timeout: 5000 }
  ).toBe('Hợp đồng dịch vụ B (updated)');

  // ========== DELETE ==========
  // Handle the confirm dialog
  page.once('dialog', (dialog) => {
    dialog.accept();
  });

  const updatedRow = page
    .locator('tr')
    .filter({ hasText: /Hợp đồng dịch vụ B \(updated\)/ })
    .first();
  await updatedRow.locator('button[title="Xóa"]').click();

  // Verify deleted from state
  await expect.poll(() => state.contracts.length, { timeout: 5000 }).toBe(initialCount);

  // Verify row no longer visible
  await expect(updatedRow).not.toBeVisible({ timeout: 5000 });
});
