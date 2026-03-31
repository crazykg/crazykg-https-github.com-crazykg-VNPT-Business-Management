import { expect, test } from '@playwright/test';
import { openCustomerRequestModule } from './helpers/customer-request-page';
import { switchToRequestListSurface, transitionRequest } from './helpers/customer-request-journey';

test('covers coding phase and DMS transfer phase transitions', async ({ page }) => {
  const state = await openCustomerRequestModule(page);

  await transitionRequest(page, 'CRC-202603-0107', 'coding', {
    textFields: [
      { label: 'Nội dung lập trình', value: 'Bắt đầu triển khai phần fix dữ liệu theo kết quả phân tích.' },
    ],
  });

  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0107')?.current_status_code ?? '').toBe('coding');

  await transitionRequest(page, 'CRC-202603-0108', 'dms_transfer', {
    textFields: [
      { label: 'Ghi chú chuyển DMS', value: 'Đã chốt dữ liệu và chuyển hồ sơ sang nhánh DMS để xử lý tiếp.' },
    ],
  });

  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0108')?.current_status_code ?? '').toBe('dms_transfer');

  await transitionRequest(page, 'CRC-202603-0108', 'completed', {
    textFields: [
      { label: 'Kết quả thực hiện', value: 'Đã hoàn tất bàn giao và khép vòng cho nhánh DMS.' },
    ],
  });

  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0108')?.current_status_code ?? '').toBe('completed');
  await expect.poll(() => state.cases.find((item) => item.request_code === 'CRC-202603-0107')?.current_status_code ?? '').toBe('coding');
  await switchToRequestListSurface(page);
});
