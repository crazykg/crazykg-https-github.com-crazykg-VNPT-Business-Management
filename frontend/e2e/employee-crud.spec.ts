import { expect, test } from '@playwright/test';
import { openEmployeeCrudModule } from './helpers/employee-crud-api-mock';

test('employee CRUD with temp password display on create', async ({ page }) => {
  const state = await openEmployeeCrudModule(page);
  const initialCount = state.employees.length;

  // ========== CREATE WITH TEMP PASSWORD ==========
  await page.getByRole('button', { name: /Tạo|Thêm/i }).click();
  await expect(page.getByRole('heading', { name: /tạo|create/i })).toBeVisible({ timeout: 5000 });

  // Fill form
  await page.getByRole('textbox', { name: /tên|full name/i }).first().fill('Nhân viên B');
  await page.getByRole('textbox', { name: /email/i }).fill('emp-b@example.com');
  await page.getByRole('textbox', { name: /điện thoại|phone/i }).fill('0987654321');
  await page.getByRole('combobox', { name: /phòng|department/i }).click();
  await page.getByText('Phòng Kỹ thuật').click();

  // Submit
  await page.getByRole('button', { name: /lưu|tạo|save|create/i }).last().click();

  // Verify created
  await expect.poll(() => state.employees.length, { timeout: 5000 }).toBe(initialCount + 1);

  // Verify temp password dialog appears
  await expect(page.getByText(/mật khẩu tạm|temp password|temporary password/i)).toBeVisible({
    timeout: 5000,
  });

  // Verify password is displayed
  const newEmployee = state.employees[state.employees.length - 1];
  if (state.lastTempPassword) {
    await expect(page.getByText(state.lastTempPassword)).toBeVisible({ timeout: 5000 });
  }

  // Close dialog
  await page.getByRole('button', { name: /đóng|close|ok/i }).first().click();

  // Verify employee row exists
  const employeeRow = page
    .locator('tr')
    .filter({ hasText: new RegExp(newEmployee.user_code) })
    .first();
  await expect(employeeRow).toBeVisible({ timeout: 5000 });

  // ========== UPDATE ==========
  await employeeRow.locator('button[title="Sửa"]').click();
  await expect(page.getByRole('heading', { name: /sửa|edit|update/i })).toBeVisible({
    timeout: 5000,
  });

  // Change department
  const deptDropdown = page.getByRole('combobox', { name: /phòng|department/i }).first();
  await deptDropdown.click();
  await page.getByText('Phòng Kinh doanh').click();

  // Submit
  await page.getByRole('button', { name: /cập nhật|update|save/i }).last().click();

  // Verify updated
  await expect.poll(() => newEmployee.department_id, { timeout: 5000 }).toBe(10);

  // ========== DELETE ==========
  page.once('dialog', (dialog) => {
    dialog.accept();
  });

  const updatedRow = page
    .locator('tr')
    .filter({ hasText: new RegExp(newEmployee.user_code) })
    .first();
  await updatedRow.locator('button[title="Xóa"]').click();

  // Verify deleted
  await expect.poll(() => state.employees.length, { timeout: 5000 }).toBe(initialCount);
  await expect(updatedRow).not.toBeVisible({ timeout: 5000 });
});
