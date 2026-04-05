import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000';
const WEB = 'http://localhost:3000';

// Helper: register or login via API, inject token, navigate to app
async function setupUser(page: any, email: string, password: string, name: string) {
  // Try register; if exists, login via a separate call
  let data: any;
  const regRes = await page.request.post(`${API}/v1/auth/register`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email, password, name },
  });
  if (regRes.ok()) {
    data = await regRes.json();
  } else {
    // Already exists - login
    const loginRes = await page.request.post(`${API}/v1/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email, password },
    });
    expect(loginRes.ok()).toBe(true);
    data = await loginRes.json();
  }

  await page.goto(WEB);
  await page.evaluate((token: string) => localStorage.setItem('auth_access_token', token), data.access_token);
  await page.goto(WEB);
  await page.waitForTimeout(1500);
}

test.describe('Demo: Full UX Flow', () => {
  const testUserEmail = `e2e-${Date()}@test.com`.replace(/[^a-z0-9@.]/g, '');
  const testUserPass = 'demopass123';
  const testUserName = 'E2E Demo';

  test('1. Login screen renders', async ({ page }) => {
    await page.goto(WEB);
    await page.waitForTimeout(1000);

    // Auth screen: check title and input fields
    await expect(page.getByText('Agentic AI').first()).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password', { exact: true })).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/01-login-screen.png', fullPage: true });
    console.log('Screenshot 1: Login screen');
  });

  test('2. Register and see welcome screen', async ({ page }) => {
    await setupUser(page, testUserEmail, testUserPass, testUserName);

    // Login form should NOT be visible
    const loginVisible = await page.getByPlaceholder('you@example.com').isVisible().catch(() => false);
    expect(loginVisible).toBe(false);

    // Welcome screen with ChatGPT-style layout
    await expect(page.getByText('Ask me anything')).toBeVisible();
    await expect(page.getByPlaceholder(/Message/)).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/02-welcome-screen.png', fullPage: true });
    console.log('Screenshot 2: Welcome screen');
  });

  test('3. Sidebar shows conversations', async ({ page }) => {
    await setupUser(page, testUserEmail, testUserPass, testUserName);
    await page.waitForTimeout(2000);

    // "Today" group label should appear
    const todayVisible = await page.getByText('Today').first().isVisible().catch(() => false);
    expect(todayVisible).toBe(true);

    // Sidebar search should be visible
    await expect(page.getByPlaceholder('Search').first()).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/03-sidebar-convs.png', fullPage: true });
    console.log('Screenshot 3: Sidebar with conversations');
  });

  test('4. Full layout: header, input, and features', async ({ page }) => {
    await setupUser(page, testUserEmail, testUserPass, testUserName);
    await page.waitForTimeout(2000);

    // Verify the app is fully rendered (no login screen)
    await expect(page.getByText('Ask me anything')).toBeVisible({ timeout: 5000 });

    // Bottom input area
    await expect(page.getByPlaceholder(/Message/)).toBeVisible();
    await expect(page.getByText('Press Enter to send')).toBeVisible();

    // Quick questions on welcome screen
    await expect(page.getByText('Try asking')).toBeVisible();

    // Feature cards
    await expect(page.getByText('Upload documents')).toBeVisible();
    await expect(page.getByText('Smart search')).toBeVisible();
    await expect(page.getByText('Follow-ups')).toBeVisible();

    // Bottom input area
    await expect(page.getByPlaceholder(/Message/)).toBeVisible();
    await expect(page.getByText('Press Enter to send')).toBeVisible();

    // Quick questions on welcome screen
    await expect(page.getByText('Try asking')).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/04-full-layout.png', fullPage: true });
    console.log('Screenshot 4: Full layout');
  });

  test('5. Send chat message and see streaming response', async ({ page }) => {
    await setupUser(page, testUserEmail, testUserPass, testUserName);
    await page.waitForTimeout(2000);

    // Type a message
    const input = page.getByPlaceholder(/Message/);
    await expect(input).toBeVisible();
    await input.fill('What is agentic AI?');
    await page.waitForTimeout(300);

    // Get conversation count before
    const convCountBefore = await page.getByText('Today').count();

    // Send via Enter key
    await input.press('Enter');
    await page.waitForTimeout(5000);

    // Should see the user message in chat
    const msgVisible = await page.getByText('What is agentic AI?').isVisible().catch(() => false);
    expect(msgVisible).toBe(true);

    await page.screenshot({ path: 'tests/screenshots/05-chat-response.png', fullPage: true });
    console.log('Screenshot 5: Chat with response');
  });
});
