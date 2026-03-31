import { expect, test } from '@playwright/test';
import {
  fillTextFieldByLabel,
  openCustomerRequestModule,
  openRequestByCode,
} from './helpers/customer-request-page';
import {
  switchToRequestListSurface,
  transitionRequest,
} from './helpers/customer-request-journey';

test('covers dispatcher handoff plus analysis -> execution -> completion path', async ({ page }) => {
  const state = await openCustomerRequestModule(page);

  await switchToRequestListSurface(page);
  await openRequestByCode(page, 'CRC-202603-0103');

  const requestDetail = page.getByRole('dialog').last();
  await requestDetail.getByRole('button', { name: /Điều phối nhanh/i }).click();
  await page.getByRole('button', { name: /Giao performer/i }).click();
  await fillTextFieldByLabel(page, 'Nội dung xử lý', 'PM giao performer cho ca này để bắt đầu nhánh xử lý.');
  await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();

  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0103')?.current_status_code ?? '').toBe('in_progress');

  await transitionRequest(page, 'CRC-202603-0107', 'in_progress', {
    textFields: [
      { label: 'Nội dung xử lý', value: 'Chuyển từ bước phân tích sang xử lý chính thức sau khi chốt phương án.' },
    ],
  });

  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0107')?.current_status_code ?? '').toBe('in_progress');

  await transitionRequest(page, 'CRC-202603-0107', 'completed', {
    textFields: [
      { label: 'Kết quả thực hiện', value: 'Đã triển khai xong điều chỉnh và sẵn sàng chốt yêu cầu.' },
    ],
  });

  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0107')?.current_status_code ?? '').toBe('completed');
  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0107')?.completed_at ?? '').not.toBe('');

  await switchToRequestListSurface(page);
  await expect(page.locator('tr').filter({ hasText: 'CRC-202603-0107' }).first()).toContainText('Hoàn thành');
});
