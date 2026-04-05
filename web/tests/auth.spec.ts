import { test, expect } from '@playwright/test';

// Helper: API login + set token in localStorage on correct origin
async function apiLoginAndGo(page: any, email = 'test@example.com', password = 'testpass123') {
  const res = await page.request.post('http://localhost:8000/v1/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { email, password },
  });
  expect(res.ok()).toBe(true);
  const data = await res.json();
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('auth_access_token', token);
  }, data.access_token);
  await page.goto('/');
  await page.waitForTimeout(2000);
}

test.describe('Auth & Chat App', () => {
  test('1 - Login page renders correctly', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=Agentic AI').first()).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password', { exact: true })).toBeVisible();
    await expect(page.locator('form').getByRole('button', { name: 'Sign In' })).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/01-login-page.png', fullPage: true });
  });

  test('2 - Login redirects to main screen', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('Enter your password', { exact: true }).fill('testpass123');
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

    await page.waitForTimeout(3000);

    const loginFormVisible = await page.getByPlaceholder('you@example.com').isVisible().catch(() => false);
    expect(loginFormVisible).toBe(false);
    await page.screenshot({ path: 'tests/screenshots/02-after-login.png', fullPage: true });
  });

  test('3 - Main screen has proper layout', async ({ page }) => {
    await apiLoginAndGo(page);

    await page.screenshot({ path: 'tests/screenshots/03-main-screen.png', fullPage: true });

    await expect(page.locator('text=Ask me anything')).toBeVisible();
    await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
  });
});
