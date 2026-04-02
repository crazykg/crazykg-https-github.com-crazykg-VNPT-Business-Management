import { expect, test } from '@playwright/test';
import { openCustomerCrudModule } from './helpers/customer-crud-api-mock';

test('customer CRUD operations with 409 conflict handling', async ({ page }) => {
  const state = await openCustomerCrudModule(page);
  const initialCount = state.customers.length;

  // ========== CREATE ==========
  await page.getByRole('button', { name: /Tạo|Thêm/i }).click();
  await expect(page.getByRole('heading', { name: /tạo|create/i })).toBeVisible({ timeout: 5000 });

  // Fill form
  await page.getByRole('textbox', { name: /tên|name/i }).first().fill('Công ty XYZ');
  await page.getByRole('textbox', { name: /điện thoại|phone/i }).fill('0987654321');
  await page.getByRole('textbox', { name: /email/i }).fill('xyz@example.com');

  // Submit
  await page.getByRole('button', { name: /lưu|tạo|save|create/i }).last().click();

  // Verify created
  await expect.poll(() => state.customers.length, { timeout: 5000 }).toBe(initialCount + 1);
  const newCustomer = state.customers[state.customers.length - 1];
  const customerRow = page
    .locator('tr')
    .filter({ hasText: new RegExp(newCustomer.customer_code) })
    .first();
  await expect(customerRow).toBeVisible({ timeout: 5000 });

  // ========== UPDATE ==========
  await customerRow.locator('button[title="Sửa"]').click();
  await expect(page.getByRole('heading', { name: /sửa|edit|update/i })).toBeVisible({
    timeout: 5000,
  });

  // Change name
  const nameInput = page.getByRole('textbox', { name: /tên|name/i }).first();
  await nameInput.clear();
  await nameInput.fill('Công ty XYZ (updated)');

  // Submit update
  await page.getByRole('button', { name: /cập nhật|update|save/i }).last().click();

  // Verify updated
  await expect.poll(() => newCustomer.name, { timeout: 5000 }).toBe('Công ty XYZ (updated)');

  // ========== DELETE WITH 409 CONFLICT ==========
  // Set state to simulate customer having contracts
  state.hasContracts = true;

  const updatedRow = page
    .locator('tr')
    .filter({ hasText: /Công ty XYZ \(updated\)/ })
    .first();

  // Try to delete — should get 409 error
  page.once('dialog', (dialog) => {
    dialog.accept(); // Accept the confirmation
  });

  await updatedRow.locator('button[title="Xóa"]').click();

  // Should see error message about having contracts
  await expect(page.getByText(/còn hợp đồng|đang hoạt động/i)).toBeVisible({
    timeout: 5000,
  });

  // Customer should NOT be deleted from state
  await expect.poll(() => state.customers.length, { timeout: 5000 }).toBe(initialCount + 1);

  // ========== DELETE SUCCESS (no contracts) ==========
  // Clear the conflict
  state.hasContracts = false;

  // Try delete again
  page.once('dialog', (dialog) => {
    dialog.accept();
  });

  const stillExistingRow = page
    .locator('tr')
    .filter({ hasText: /Công ty XYZ \(updated\)/ })
    .first();
  await stillExistingRow.locator('button[title="Xóa"]').click();

  // Now should delete successfully
  await expect.poll(() => state.customers.length, { timeout: 5000 }).toBe(initialCount);

  // Row should no longer be visible
  await expect(stillExistingRow).not.toBeVisible({ timeout: 5000 });
});
