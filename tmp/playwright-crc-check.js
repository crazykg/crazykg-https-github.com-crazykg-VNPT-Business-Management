const { chromium } = require('@playwright/test');

const BASE_URL = 'http://localhost:5174';
const USERNAME = 'ropv.hgi';
const PASSWORD = 'ropv.hgi';

async function maybeLogin(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const loginHeading = page.getByRole('heading', { name: 'Đăng nhập' });
  if (await loginHeading.count()) {
    await page.locator('input[autocomplete="username"]').fill(USERNAME);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
  }

  await page.waitForLoadState('networkidle', { timeout: 60000 });
}

async function openCustomerRequestModule(page) {
  const moduleButton = page.getByRole('button', { name: /Quản lý yêu cầu KH|Quản lý yêu cầu khách hàng/i }).first();
  await moduleButton.waitFor({ state: 'visible', timeout: 60000 });
  await moduleButton.click();

  const listHeading = page.getByRole('heading', { name: /Quản lý yêu cầu khách hàng/i }).first();
  await listHeading.waitFor({ state: 'visible', timeout: 60000 });
}

async function openCreateModal(page) {
  const createButton = page.getByRole('button', { name: /Thêm yêu cầu|Tạo yêu cầu mới/i }).first();
  await createButton.waitFor({ state: 'visible', timeout: 60000 });
  await createButton.click();

  await page.getByRole('heading', { name: /Tạo yêu cầu mới|Yêu cầu mới/i }).first().waitFor({ state: 'visible', timeout: 30000 });
}

function fieldContainerByLabel(page, labelRegex) {
  return page
    .locator('label:visible')
    .filter({ hasText: labelRegex })
    .first()
    .locator('xpath=ancestor::div[.//input or .//textarea or .//select or .//button[@aria-haspopup="listbox"]][1]');
}

async function selectFirstOptionByLabel(page, labelRegex) {
  const container = fieldContainerByLabel(page, labelRegex);
  const trigger = container.locator('button[aria-haspopup="listbox"]').first();
  if (!await trigger.count()) return false;

  await trigger.click();
  const searchInput = page.locator('input[aria-label^="Tìm "], input[placeholder*="Tìm"]').last();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.press('ArrowDown');
  await searchInput.press('Enter');
  await page.waitForTimeout(200);
  return true;
}

async function fillTextByLabel(page, labelRegex, value) {
  const container = fieldContainerByLabel(page, labelRegex);
  const input = container.locator('input[type="text"], textarea, input[type="number"]').first();
  if (!await input.count()) return false;
  await input.fill(value);
  return true;
}

async function createRequest(page) {
  await selectFirstOptionByLabel(page, /Khách hàng/i);
  await page.waitForTimeout(200);

  await selectFirstOptionByLabel(page, /Người yêu cầu|Người liên hệ KH/i);
  await selectFirstOptionByLabel(page, /Dự án|Hạng mục dự án|Sản phẩm/i);
  await selectFirstOptionByLabel(page, /Nhóm hỗ trợ/i);
  await selectFirstOptionByLabel(page, /Độ ưu tiên/i);
  await selectFirstOptionByLabel(page, /Kênh tiếp nhận/i);

  const stamp = Date.now();
  await fillTextByLabel(page, /Tóm tắt yêu cầu/i, `PW tạo mới CRC ${stamp}`);
  await fillTextByLabel(page, /Mô tả chi tiết/i, `Playwright kiểm tra transition dropdown ${stamp}`);

  const saveButton = page.getByRole('button', { name: /Tạo yêu cầu/i }).last();
  await saveButton.click();

  await page.waitForTimeout(1800);
}

async function getTransitionOptions(page) {
  const transitionSelect = page.locator('xpath=//span[contains(@class,"material-symbols-outlined") and normalize-space()="arrow_forward"]/following::select[1]').first();
  await transitionSelect.waitFor({ state: 'visible', timeout: 30000 });

  const options = await transitionSelect.locator('option').allTextContents();
  return options.map((text) => text.trim()).filter(Boolean);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/v5/customer-request-cases') && response.request().method() === 'POST') {
      console.log(`[api] create status=${response.status()} url=${url}`);
    }
  });

  try {
    await maybeLogin(page);
    await openCustomerRequestModule(page);
    await openCreateModal(page);
    await createRequest(page);

    const options = await getTransitionOptions(page);
    const hasGiaoR = options.some((option) => /Giao\s*R\s*thực\s*hiện/i.test(option));

    await page.screenshot({ path: 'c:/Users/pchgi/Documents/code/qlcv2/tmp/playwright-crc-transition.png', fullPage: true });

    console.log(JSON.stringify({
      success: true,
      transitionOptions: options,
      hasGiaoR,
      screenshot: 'tmp/playwright-crc-transition.png',
    }, null, 2));
  } catch (error) {
    await page.screenshot({ path: 'c:/Users/pchgi/Documents/code/qlcv2/tmp/playwright-crc-transition-error.png', fullPage: true });
    console.error(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      screenshot: 'tmp/playwright-crc-transition-error.png',
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
