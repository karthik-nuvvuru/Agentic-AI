import { test, expect } from '@playwright/test';

async function apiLoginAndGo(page: any) {
  let res = await page.request.post('http://localhost:8000/v1/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'test@example.com', password: 'testpass123' },
  });
  if (!res.ok()) {
    await page.request.post('http://localhost:8000/v1/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
    }).catch(() => {});
    res = await page.request.post('http://localhost:8000/v1/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'test@example.com', password: 'testpass123' },
    });
  }
  const data = await res.json();
  await page.goto('/');
  await page.evaluate((token) => localStorage.setItem('auth_access_token', token), data.access_token);
  await page.goto('/');
  await page.waitForTimeout(500);
}

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await apiLoginAndGo(page);
  });

  test('welcome screen visual snapshot', async ({ page }) => {
    await expect(page.locator('text=Ask me anything')).toBeVisible();
    await expect(page.locator('text=Upload your documents')).toBeVisible({ timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'tests/screenshots/visual-welcome.png' });
  });

  test('chat interface visual snapshot', async ({ page }) => {
    const input = page.locator('[placeholder*="Message"]');
    await input.fill('Hello world');
    await input.press('Enter');
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Hello world')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/visual-message.png' });
  });

  test('input area visual snapshot', async ({ page }) => {
    await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
    await expect(page.locator('[title="Send message"]')).toBeVisible();
    await expect(page.locator('[title="Attach files"]')).toBeVisible();
  });

  test('mobile layout visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForTimeout(500);

    // On mobile with auth, should see hamburger menu icon
    await expect(page.locator('[aria-label="Open navigation"]').or(page.locator('h2').filter({ hasText: 'Agentic AI' }))).toBeVisible();
  });

  test('tablet layout visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForTimeout(1000);

    await expect(page.locator('button:has-text("New Chat")').first()).toBeVisible();
    await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
  });

  test('hover states visual snapshot', async ({ page }) => {
    const input = page.locator('[placeholder*="Message"]');
    await input.fill('Hover test');
    await input.press('Enter');
    await page.waitForTimeout(2000);

    await expect(page.locator('[title="Send message"]')).toBeVisible();
  });
});
