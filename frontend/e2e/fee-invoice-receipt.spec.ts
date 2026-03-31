import { expect, test } from '@playwright/test';
import { openFeeCollectionModule } from './helpers/fee-collection-api-mock';
import { fieldContainerByLabel } from './helpers/customer-request-page';

async function selectNativeField(page: import('@playwright/test').Page, label: string, value: string): Promise<void> {
  await fieldContainerByLabel(page, label).locator('select').first().selectOption(value);
}

async function fillField(page: import('@playwright/test').Page, label: string, value: string): Promise<void> {
  await fieldContainerByLabel(page, label).locator('input,textarea').first().fill(value);
}

test('covers invoice create-update-delete plus receipt reconcile flow', async ({ page }) => {
  const state = await openFeeCollectionModule(page);
  const initialInvoiceCount = state.invoices.length;
  const initialReceiptCount = state.receipts.length;

  const getInvoiceByItemDescription = (description: string) =>
    state.invoices.find((invoice) => Array.isArray(invoice.items) && invoice.items.some((item) => String(item.description) === description));

  await page.getByRole('button', { name: /Hóa đơn/ }).click();
  await expect(page.getByText('INV-202601-0001')).toBeVisible();

  await page.getByRole('button', { name: /Tạo hóa đơn/ }).click();
  await expect(page.getByRole('heading', { name: 'Tạo hóa đơn' })).toBeVisible();
  await selectNativeField(page, 'Hợp đồng', '101');
  const draftRow = page.getByRole('textbox', { name: 'Tên dịch vụ / sản phẩm' }).first().locator('xpath=ancestor::tr[1]');
  await page.getByRole('textbox', { name: 'Tên dịch vụ / sản phẩm' }).first().fill('Gói kiểm thử draft');
  await draftRow.getByRole('textbox', { name: 'Tháng' }).fill('Gói');
  await draftRow.getByRole('spinbutton').nth(1).fill('5000000');
  await page.getByRole('button', { name: /Tạo hóa đơn/ }).last().click();

  await expect.poll(() => state.invoices.length).toBe(initialInvoiceCount + 1);
  const draftInvoice = () => getInvoiceByItemDescription('Gói kiểm thử draft');
  await expect.poll(() => draftInvoice()?.invoice_code ?? '').not.toBe('');

  const draftInvoiceCode = draftInvoice()?.invoice_code ?? '';
  const draftInvoiceListRow = page.locator('tr').filter({ hasText: draftInvoiceCode }).first();
  await draftInvoiceListRow.locator('button[title="Sửa"]').click();
  await fillField(page, 'Hạn thanh toán', '2026-05-05');
  await page.getByRole('button', { name: /^Cập nhật$/ }).click();
  await expect.poll(() => draftInvoice()?.due_date ?? '').toBe('2026-05-05');

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await draftInvoiceListRow.locator('button[title="Xóa"]').click();
  await expect.poll(() => state.invoices.some((invoice) => invoice.invoice_code === draftInvoiceCode)).toBe(false);

  await page.getByRole('button', { name: /Tạo hóa đơn/ }).click();
  await expect(page.getByRole('heading', { name: 'Tạo hóa đơn' })).toBeVisible();
  await selectNativeField(page, 'Hợp đồng', '101');
  const reconcileRow = page.getByRole('textbox', { name: 'Tên dịch vụ / sản phẩm' }).first().locator('xpath=ancestor::tr[1]');
  await page.getByRole('textbox', { name: 'Tên dịch vụ / sản phẩm' }).first().fill('Gói thu cước đối soát');
  await reconcileRow.getByRole('textbox', { name: 'Tháng' }).fill('Tháng');
  await reconcileRow.getByRole('spinbutton').nth(1).fill('3500000');
  await page.getByRole('button', { name: /Tạo hóa đơn/ }).last().click();

  const reconciledInvoice = () => getInvoiceByItemDescription('Gói thu cước đối soát');
  await expect.poll(() => reconciledInvoice()?.invoice_code ?? '').not.toBe('');

  const reconcileInvoiceCode = reconciledInvoice()?.invoice_code ?? '';
  const reconcileInvoiceRow = page.locator('tr').filter({ hasText: reconcileInvoiceCode }).first();
  await reconcileInvoiceRow.locator('button[title="Phát hành"]').click();
  await expect.poll(() => reconciledInvoice()?.status ?? '').toBe('ISSUED');

  await page.getByRole('button', { name: /Phiếu thu/ }).click();
  await expect(page.getByText('RCP-202601-0001')).toBeVisible();
  await page.getByRole('button', { name: /Tạo phiếu thu/ }).click();
  await expect(page.getByRole('heading', { name: 'Tạo phiếu thu' })).toBeVisible();
  await selectNativeField(page, 'Hợp đồng', '101');
  await fillField(page, 'Số tiền (VND)', String(reconciledInvoice()?.total_amount ?? 0));
  await fillField(page, 'Ngân hàng', 'BIDV');
  await fillField(page, 'Mã giao dịch', 'FT-CRC-202603-001');
  await page.getByRole('button', { name: /Tạo phiếu thu/ }).last().click();

  await expect.poll(() => state.receipts.length).toBe(initialReceiptCount + 1);
  await expect.poll(() => state.receipts.find((receipt) => receipt.invoice_code === reconcileInvoiceCode)?.receipt_code ?? '').not.toBe('');
  await expect.poll(() => reconciledInvoice()?.status ?? '').toBe('PAID');
  await expect.poll(() => Number(reconciledInvoice()?.outstanding ?? -1)).toBe(0);

  await page.getByRole('button', { name: /Hóa đơn/ }).click();
  await expect(page.locator('tr').filter({ hasText: reconcileInvoiceCode }).first()).toContainText('Đã thanh toán');
});
