import { expect, test } from '@playwright/test';
import {
  type MockCustomerRequestCase,
  buildCustomerRequestScenarioState,
} from './helpers/customer-request-fixtures';
import { registerCustomerRequestScenarioMock } from './helpers/customer-request-api-mock';

function buildNonAttentionCase(
  template: MockCustomerRequestCase,
  index: number
): MockCustomerRequestCase {
  const id = 300 + index;
  const paddedIndex = String(index + 1).padStart(2, '0');

  return {
    ...template,
    id,
    request_code: `CRC-202603-03${paddedIndex}`,
    summary: `Case nền không cần chú ý #${paddedIndex}`,
    description: `Case nền để đẩy attention case ra khỏi trang list đầu tiên #${paddedIndex}.`,
    current_status_code: 'customer_notified',
    estimated_hours: 3,
    total_hours_spent: 2,
    sla_due_at: null,
    completed_at: `2026-03-22 1${String(index % 10)}:00:00`,
    created_at: `2026-03-22 1${String(index % 10)}:00:00`,
    updated_at: `2026-03-22 1${String(index % 10)}:30:00`,
    status_rows: {
      customer_notified: {
        notification_channel: 'Email',
        notification_content: `Đã báo khách hàng cho case nền #${paddedIndex}.`,
      },
    },
    attachments: [],
    ref_tasks: [],
    estimates: [
      {
        id: 9000 + index,
        request_case_id: id,
        status_code: 'customer_notified',
        estimated_hours: 3,
        estimate_scope: 'total',
        estimate_type: 'manual',
        note: `Estimate case nền #${paddedIndex}`,
        estimated_by_user_id: 1,
        estimated_by_name: 'Smoke Tester',
        estimated_at: `2026-03-22 1${String(index % 10)}:05:00`,
      },
    ],
    worklogs: [],
    timeline: [
      {
        id: 9500 + index,
        yeu_cau_id: id,
        tien_trinh: 'Báo khách hàng',
        status_code: 'customer_notified',
        trang_thai_cu: null,
        trang_thai_moi: 'customer_notified',
        nguoi_thay_doi_id: 1,
        nguoi_thay_doi_name: 'Smoke Tester',
        ly_do: null,
        thay_doi_luc: `2026-03-22 1${String(index % 10)}:30:00`,
      },
    ],
  };
}

test.describe('Customer request attention open flow', () => {
  test('opens list + detail for an overview attention case outside the current list page', async ({
    page,
  }) => {
    const state = buildCustomerRequestScenarioState();
    const closedTemplate = state.cases.find(
      (item) => item.current_status_code === 'customer_notified'
    );

    if (!closedTemplate) {
      throw new Error('Thiếu template customer_notified cho e2e.');
    }

    state.cases.push(
      ...Array.from({ length: 24 }, (_, index) =>
        buildNonAttentionCase(closedTemplate, index)
      )
    );

    await registerCustomerRequestScenarioMock(page, state);
    await page.goto('/?tab=customer_request_management');

    await expect(
      page.getByRole('heading', { name: 'Quản lý yêu cầu khách hàng' }).first()
    ).toBeVisible();
    await expect(page.getByText('Ca cần chú ý ngay')).toBeVisible();

    await page.getByRole('button', { name: /CRC-202603-0103/i }).click();

    await expect(page.getByText(/Hiển thị/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Đóng/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ca mới chờ điều phối/i })).toBeVisible();
  });
});
