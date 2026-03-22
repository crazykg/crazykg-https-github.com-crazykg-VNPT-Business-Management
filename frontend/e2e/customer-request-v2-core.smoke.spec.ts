import { expect, test } from '@playwright/test';
import {
  fillTextFieldByLabel,
  openCustomerRequestModule,
  selectSearchableOptionByLabel,
} from './helpers/customer-request-page';

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

    await expect(page.getByText(/đã được tạo và đưa sang luồng xử lý/i)).toBeVisible();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Đang xử lý/i)).toBeVisible();

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

    await expect(page.getByText(/đã được tạo và chuyển vào hàng chờ điều phối/i)).toBeVisible();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Mới tiếp nhận/i)).toBeVisible();
  });

  test('handles creator feedback and notify-customer flows', async ({ page }) => {
    await openCustomerRequestModule(page);

    await page.getByRole('button', { name: /Người tạo|Tôi tạo/i }).first().click();
    await page.getByRole('button', { name: /CRC-202603-0101/i }).first().click();
    await expect(page.getByRole('button', { name: /Đánh giá KH/i })).toBeVisible();
    await page.getByRole('button', { name: /Đánh giá KH/i }).click();
    await page.getByLabel(/Yêu cầu KH bổ sung/i).check();
    await page.getByLabel(/Nội dung cần khách hàng bổ sung/i).fill('Vui lòng bổ sung thêm file log vào đầu giờ chiều.');
    await page.getByLabel(/Ghi chú đánh giá/i).fill('Creator đã rà soát và cần thêm dữ liệu.');
    await page.getByLabel(/Activity/i).selectOption('analysis');
    await page.getByLabel(/Giờ công/i).fill('0.5');
    await page.getByLabel(/Ngày làm việc/i).fill('2026-03-21');
    await page.getByLabel(/Nội dung worklog/i).fill('Đánh giá phản hồi khách hàng và yêu cầu bổ sung thêm.');
    await page.getByRole('button', { name: /Lưu đánh giá KH/i }).click();

    await expect(page.getByText(/tiếp tục chờ khách hàng bổ sung thông tin/i)).toBeVisible();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Đợi phản hồi KH/i)).toBeVisible();

    await page.getByRole('button', { name: /Danh sách/i }).click();
    await page.getByRole('button', { name: /CRC-202603-0102/i }).first().click();
    await page.getByRole('button', { name: /campaign Báo KH/i }).click();
    await page.getByLabel(/Kênh báo/i).selectOption('Email');
    await page.getByLabel(/Nội dung đã báo khách hàng/i).fill('Đã gửi email xác nhận kết quả và hướng dẫn kiểm tra.');
    await page.getByLabel(/Phản hồi của KH/i).fill('Khách hàng đã nhận và xác nhận ổn.');
    await page.getByLabel(/Ghi chú nội bộ/i).fill('Đóng ca sau khi khách hàng đồng ý.');
    await page.getByLabel(/Activity/i).selectOption('support');
    await page.getByLabel(/Giờ công/i).fill('0.5');
    await page.getByLabel(/Ngày làm việc/i).fill('2026-03-21');
    await page.getByLabel(/Nội dung worklog/i).fill('Đã gửi email báo kết quả cho khách hàng.');
    await page.getByRole('button', { name: /Xác nhận - Kết thúc YC/i }).click();

    await expect(page.getByText(/đã được ghi nhận báo khách hàng/i)).toBeVisible();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Báo khách hàng/i)).toBeVisible();
  });

  test('runs dispatcher, performer, search, dashboard, and detail-tab smoke flows', async ({ page }) => {
    await openCustomerRequestModule(page);

    await page.getByRole('button', { name: /Điều phối|Tôi điều phối/i }).first().click();
    await page.getByRole('button', { name: /CRC-202603-0103/i }).first().click();
    await page.getByRole('button', { name: /Điều phối nhanh/i }).click();
    await page.getByRole('button', { name: /Giao performer/i }).click();
    await selectSearchableOptionByLabel(page, 'Người xử lý', 'Dev Bình', /Dev Bình/i);
    await fillTextFieldByLabel(page, 'Nội dung xử lý', 'PM giao Dev Bình tiếp nhận và xử lý ngay.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Đang xử lý/i)).toBeVisible();

    await page.getByRole('button', { name: /Danh sách/i }).click();
    await page.getByRole('button', { name: /Người xử lý|Tôi xử lý/i }).first().click();
    await page.getByRole('button', { name: /CRC-202603-0105/i }).first().click();
    await page.getByRole('button', { name: /Performer nhanh/i }).click();
    await page.getByRole('button', { name: /Nhận việc/i }).click();
    await selectSearchableOptionByLabel(page, 'Người xử lý', 'Smoke', /Smoke Tester/i);
    await fillTextFieldByLabel(page, 'Nội dung xử lý', 'Performer xác nhận đã nhận việc.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Đang xử lý/i)).toBeVisible();

    await page.getByRole('button', { name: /Danh sách/i }).click();
    await page.getByRole('button', { name: /CRC-202603-0104/i }).first().click();
    await page.getByRole('button', { name: /Performer nhanh/i }).click();
    await page.getByRole('button', { name: /Hoàn thành/i }).click();
    await selectSearchableOptionByLabel(page, 'Người hoàn thành', 'Smoke', /Smoke Tester/i);
    await fillTextFieldByLabel(page, 'Kết quả thực hiện', 'Đã hoàn tất xử lý mapping dữ liệu.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Hoàn thành/i)).toBeVisible();

    await page.getByRole('button', { name: /Danh sách/i }).click();
    await page.getByRole('button', { name: /CRC-202603-0105/i }).first().click();
    await page.getByRole('button', { name: /Performer nhanh/i }).click();
    await page.getByRole('button', { name: /Trả người quản lý/i }).click();
    await fillTextFieldByLabel(page, 'Lý do chuyển trả', 'Cần PM xác nhận lại phạm vi trước khi tiếp tục.');
    await page.getByRole('button', { name: /Xác nhận chuyển trạng thái/i }).click();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Trả người quản lý/i)).toBeVisible();

    await page.getByRole('button', { name: /Danh sách/i }).click();
    await page.locator('input[placeholder*="Mở nhanh"]').fill('0104');
    await page.getByRole('button', { name: /CRC-202603-0104/i }).first().click();
    await expect(page.getByText('CRC-202603-0104')).toBeVisible();

    await page.getByRole('button', { name: /Danh sách/i }).click();
    await page.getByRole('button', { name: /Người tạo|Tôi tạo/i }).first().click();
    await page.getByRole('button', { name: /CRC-202603-0101/i }).first().click();
    await expect(page.getByText(/Tiến trình hiện tại:\s*Đợi phản hồi KH/i)).toBeVisible();

    await page.getByRole('button', { name: /Giờ công/i }).click();
    await expect(page.getByText(/Estimate & Giờ công/i)).toBeVisible();
    await page.getByRole('button', { name: /Est/i }).click();
    await expect(page.getByText(/Estimate gần nhất/i)).toBeVisible();
    await page.getByRole('button', { name: /File/i }).click();
    await expect(page.getByRole('link', { name: /log-hien-trang\.zip/i })).toBeVisible();
    await page.getByRole('button', { name: /Task\/Ref/i }).click();
    await expect(page.locator('input[value*="IT360-0101"]').first()).toBeVisible();
    await page.getByRole('button', { name: /Timeline/i }).click();
    await expect(page.getByRole('heading', { name: /Đợi phản hồi KH/i })).toBeVisible();
  });
});
