import { expect, test } from '@playwright/test';
import {
  fillTextFieldByLabel,
  openCustomerRequestModule,
  openRequestByCode,
  selectSearchableOptionByLabel,
} from './helpers/customer-request-page';

const closeTopDialogIfOpen = async (page: import('@playwright/test').Page) => {
  for (let index = 0; index < 3; index += 1) {
    const dialog = page.getByRole('dialog').last();
    if (!await dialog.count()) {
      return;
    }

    const closeButton = dialog.getByRole('button', { name: /Đóng|close/i }).first();
    if (!await closeButton.count()) {
      return;
    }

    await closeButton.evaluate((node) => {
      (node as HTMLButtonElement).click();
    });
    await page.waitForTimeout(150);
  }
};

const switchToRequestListSurface = async (page: import('@playwright/test').Page) => {
  await closeTopDialogIfOpen(page);
  const listSurfaceButton = page.getByRole('button', { name: /table_rows Danh sách/i }).first();
  await listSurfaceButton.evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  await expect(page.locator('input[placeholder*="Tìm mã YC"], input[placeholder*="Tìm YC tôi"], input[placeholder*="Tìm việc tôi"]').first()).toBeVisible();
};

const topSurface = async (page: import('@playwright/test').Page) => {
  const dialog = page.getByRole('dialog').last();
  if (await dialog.count()) {
    return dialog;
  }
  return page.locator('main').first();
};

const clickTopSurfaceButton = async (page: import('@playwright/test').Page, name: RegExp) => {
  const scope = await topSurface(page);
  const button = scope.getByRole('button', { name }).first();
  await expect(button).toBeVisible();
  await button.click();
};

const requestRow = (page: import('@playwright/test').Page, requestCode: string) =>
  page.locator('tr').filter({ hasText: requestCode }).first();

test.describe('Customer request V2 core smoke', () => {
  test('creates requests in self-handle and assign-PM branches', async ({ page }) => {
    await openCustomerRequestModule(page);

    await page.getByRole('button', { name: /Thêm yêu cầu|Tạo yêu cầu mới/i }).click();
    await expect(page.getByRole('heading', { name: /Tạo yêu cầu mới|Yêu cầu mới/i })).toBeVisible();

    await selectSearchableOptionByLabel(page, 'Khách hàng', 'VNPT', /VNPT Hà Nội/i);
    await selectSearchableOptionByLabel(page, 'Người liên hệ KH', 'Nguyễn', /Nguyễn Văn A/i);
    await selectSearchableOptionByLabel(page, 'Hạng mục dự án', 'SOC', /VNPT Hà Nội.*SOC Portal/i);
    await selectSearchableOptionByLabel(page, 'Nhóm hỗ trợ', 'SOC', /Nhóm SOC 01/i);
    await fillTextFieldByLabel(page, 'Tóm tắt yêu cầu', 'UAT self-handle case');
    await fillTextFieldByLabel(page, 'Mô tả chi tiết', 'Kiểm tra tạo yêu cầu với nhánh tự xử lý.');
    await selectSearchableOptionByLabel(page, 'Độ ưu tiên', 'Cao', /Cao/i);
    await selectSearchableOptionByLabel(page, 'Kênh tiếp nhận', 'Phone', /Phone/i);
    await fillTextFieldByLabel(page, 'Giờ ước lượng', '4');
    await fillTextFieldByLabel(page, 'Ghi chú ước lượng', 'Estimate từ smoke UAT.');
    await page.getByRole('button', { name: /Tự xử lý/i }).click();
    await selectSearchableOptionByLabel(page, 'Người xử lý', 'Smoke', /Smoke Tester/i);
    await page.getByRole('button', { name: /Tạo yêu cầu|Lưu \(F1\)/i }).click();

    const selfHandleRow = page.locator('tr').filter({ hasText: 'CRC-202603-0500' }).first();
    await expect(selfHandleRow).toBeVisible();
    await expect(selfHandleRow).toContainText('Mới tiếp nhận');
    await expect(selfHandleRow).toContainText('Chờ Performer nhận việc');
    await closeTopDialogIfOpen(page);

    await page.getByRole('button', { name: /Thêm yêu cầu|Tạo yêu cầu mới/i }).click();
    await expect(page.getByRole('heading', { name: /Tạo yêu cầu mới|Yêu cầu mới/i })).toBeVisible();
    await selectSearchableOptionByLabel(page, 'Khách hàng', 'Bệnh viện', /Bệnh viện Số 2/i);
    await selectSearchableOptionByLabel(page, 'Người liên hệ KH', 'Trần', /Trần Thị B/i);
    await selectSearchableOptionByLabel(page, 'Hạng mục dự án', 'NOC', /Bệnh viện Số 2.*NOC Console/i);
    await selectSearchableOptionByLabel(page, 'Nhóm hỗ trợ', 'NOC', /Nhóm NOC 02/i);
    await fillTextFieldByLabel(page, 'Tóm tắt yêu cầu', 'UAT assign-dispatcher case');
    await fillTextFieldByLabel(page, 'Mô tả chi tiết', 'Kiểm tra tạo yêu cầu với nhánh chuyển PM.');
    await selectSearchableOptionByLabel(page, 'Độ ưu tiên', 'Khẩn', /Khẩn/i);
    await selectSearchableOptionByLabel(page, 'Kênh tiếp nhận', 'Zalo', /Zalo/i);
    await page.getByRole('button', { name: /Chuyển PM/i }).click();
    await selectSearchableOptionByLabel(page, 'PM điều phối', 'PM Lan', /PM Lan/i);
    await page.getByRole('button', { name: /Tạo yêu cầu|Lưu \(F1\)/i }).click();

    const assignPmRow = page.locator('tr').filter({ hasText: 'CRC-202603-0501' }).first();
    await expect(assignPmRow).toBeVisible();
    await expect(assignPmRow).toContainText('Mới tiếp nhận');
  });

  test('handles creator feedback and notify-customer flows', async ({ page }) => {
    await openCustomerRequestModule(page);

    await page.getByRole('button', { name: /Người tạo|Tôi tạo/i }).first().click();
    await openRequestByCode(page, 'CRC-202603-0101');
    await clickTopSurfaceButton(page, /Chuyển/i);
    await selectSearchableOptionByLabel(page, 'Người xử lý', 'Smoke', /Smoke Tester/i);
    await fillTextFieldByLabel(page, 'Nội dung xử lý', 'Creator đã rà soát phản hồi của khách hàng và mở lại flow xử lý.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();

    await expect(page.getByText('Đang xử lý', { exact: true }).last()).toBeVisible();

    await switchToRequestListSurface(page);
    await openRequestByCode(page, 'CRC-202603-0102');
    await clickTopSurfaceButton(page, /Xử lý nhanh/i);
    await clickTopSurfaceButton(page, /Báo khách hàng/i);
    await fillTextFieldByLabel(page, 'Nội dung đã báo khách hàng', 'Đã gửi email xác nhận kết quả và hướng dẫn kiểm tra.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();

    await expect(page.getByText('Báo khách hàng', { exact: true }).last()).toBeVisible();
  });

  test('runs dispatcher, performer, search, dashboard, and detail-tab smoke flows', async ({ page }) => {
    await openCustomerRequestModule(page);

    await page.getByRole('button', { name: /Điều phối|Tôi điều phối/i }).first().click();
    await openRequestByCode(page, 'CRC-202603-0103');
    await clickTopSurfaceButton(page, /Điều phối nhanh/i);
    await clickTopSurfaceButton(page, /Giao performer/i);
    await selectSearchableOptionByLabel(page, 'Người xử lý', 'Dev Bình', /Dev Bình/i);
    await fillTextFieldByLabel(page, 'Nội dung xử lý', 'PM giao Dev Bình tiếp nhận và xử lý ngay.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
    await expect(page.getByText('Đang xử lý', { exact: true }).last()).toBeVisible();

    await switchToRequestListSurface(page);
    await page.getByRole('button', { name: /Người xử lý|Tôi xử lý/i }).first().click();
    await openRequestByCode(page, 'CRC-202603-0105');
    await clickTopSurfaceButton(page, /Xử lý nhanh|Performer nhanh/i);
    await clickTopSurfaceButton(page, /Nhận việc/i);
    await selectSearchableOptionByLabel(page, 'Người xử lý', 'Smoke', /Smoke Tester/i);
    await fillTextFieldByLabel(page, 'Nội dung xử lý', 'Performer xác nhận đã nhận việc.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
    await expect(page.getByText('Đang xử lý', { exact: true }).last()).toBeVisible();

    await switchToRequestListSurface(page);
    await openRequestByCode(page, 'CRC-202603-0104');
    await clickTopSurfaceButton(page, /Xử lý nhanh|Performer nhanh/i);
    await clickTopSurfaceButton(page, /Hoàn thành/i);
    await selectSearchableOptionByLabel(page, 'Người hoàn thành', 'Smoke', /Smoke Tester/i);
    await fillTextFieldByLabel(page, 'Kết quả thực hiện', 'Đã hoàn tất xử lý mapping dữ liệu.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
    await expect(page.getByText('Hoàn thành', { exact: true }).last()).toBeVisible();

    await switchToRequestListSurface(page);
    await openRequestByCode(page, 'CRC-202603-0104');
    const activeDetail = page.getByRole('dialog').last();
    await expect(activeDetail.getByText('CRC-202603-0104').first()).toBeVisible();

    await activeDetail.getByRole('button', { name: /Giờ công/i }).click();
    await expect(page.getByText(/Estimate & Giờ công/i)).toBeVisible();
    await activeDetail.getByRole('button', { name: /Ước lượng/i }).click();
    await expect(page.getByText(/Ước lượng gần nhất/i)).toBeVisible();
    await activeDetail.getByRole('button', { name: /Tệp/i }).click();
    await expect(page.getByRole('link', { name: /mapping\.xlsx/i })).toBeVisible();
    await activeDetail.getByRole('button', { name: /Task\/Ref/i }).click();
    await expect(page.getByText(/Task liên quan/i)).toBeVisible();
    await activeDetail.getByRole('button', { name: /Dòng thời gian/i }).click();
    await expect(page.getByRole('heading', { name: /Hoàn thành/i })).toBeVisible();
  });
});
