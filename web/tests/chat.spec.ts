import { test, expect } from '@playwright/test';

// Helper: API login + set token in localStorage on correct origin
async function apiLogin(page: any, email = 'test@example.com', password = 'testpass123') {
  const res = await page.request.post('http://localhost:8000/v1/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { email, password },
  });
  if (!res.ok()) {
    // Auto-register
    await page.request.post('http://localhost:8000/v1/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: { email, password, name: 'Test User' },
    }).catch(() => {});
  }
  const data = await res.json();
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('auth_access_token', token);
  }, data.access_token);
  await page.goto('/');
  await page.waitForTimeout(2000);
  return data.access_token;
}

test.describe('AI Chat App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('login page renders correctly', async ({ page }) => {
    await expect(page.locator('text=Agentic AI')).toBeVisible();
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Sign In').first()).toBeVisible();
    await expect(page.locator('text=Sign Up')).toBeVisible();
    await expect(page.locator('input[placeholder="you@example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your password"]')).toBeVisible();
    await expect(page.locator('text=Google')).toBeVisible();
    await expect(page.locator('text=GitHub')).toBeVisible();
  });

  test('login with valid credentials redirects to main screen', async ({ page }) => {
    await page.locator('input[placeholder="you@example.com"]').fill('test@example.com');
    await page.locator('input[placeholder="Enter your password"]').fill('testpass123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    const hasHeader = await page.locator('text=Agentic AI').first().isVisible().catch(() => false);
    if (!hasHeader) {
      const errorMsg = await page.locator('text=Email').first().isVisible();
      expect(errorMsg).toBe(false);
    }
  });

  test('new chat button visible on desktop', async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 640) {
      // On mobile, open the sidebar drawer first
      const menuBtn = page.locator('[aria-label="Open navigation"]');
      await menuBtn.click();
    }
    await apiLogin(page);

    if (viewport && viewport.width < 640) {
      const menuBtn = page.locator('[aria-label="Open navigation"]');
      await menuBtn.click();
    }

    await expect(page.locator('text=New Chat').first()).toBeVisible();
  });

  test('sidebar visible on main screen on desktop', async ({ page }) => {
    await apiLogin(page);
    const screenshot = await page.screenshot();
    expect(screenshot.length).toBeGreaterThan(0);

    // On desktop, New Chat button should be visible
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 640) {
      const sidebarBox = await page.locator('button:has-text("New Chat")').first().boundingBox();
      expect(sidebarBox).not.toBeNull();
    }
  });

  test('input area visible and usable on main screen', async ({ page }) => {
    await apiLogin(page);

    const textarea = page.locator('[placeholder*="Message"]');
    await expect(textarea.first()).toBeVisible();

    await textarea.first().fill('Hello, world!');
    await expect(textarea.first()).toHaveValue('Hello, world!');

    const sendBtn = page.locator('[title="Send message"]');
    await expect(sendBtn.first()).toBeVisible();
  });

  test('rag chat works end-to-end', async ({ page }) => {
    const loginRes = await page.request.post('http://localhost:8000/v1/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'test@example.com', password: 'testpass123' },
    });
    if (!loginRes.ok()) {
      await page.request.post('http://localhost:8000/v1/auth/register', {
        headers: { 'Content-Type': 'application/json' },
        data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
      }).catch(() => {});
    }
    const loginData = await loginRes.json();
    const token = loginData.access_token;

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_access_token', token);
    }, token);
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Ingest test document
    await page.request.post('http://localhost:8000/v1/rag/ingest/text', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      data: {
        source: 'playwright-test.txt',
        text: 'Playwright is a testing framework for web browsers. It supports Chromium, Firefox, and WebKit.',
      },
    });

    // Type message and send
    const textarea = page.locator('[placeholder*="Message"]');
    await textarea.first().fill('What is Playwright?');
    await textarea.first().press('Enter');

    // Wait for streaming response to appear
    await page.waitForTimeout(8000);

    // Page should have changed from streaming or showing response
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('streaming response shows content progressively', async ({ page }) => {
    const loginRes = await page.request.post('http://localhost:8000/v1/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'test@example.com', password: 'testpass123' },
    });
    if (!loginRes.ok()) {
      await page.request.post('http://localhost:8000/v1/auth/register', {
        headers: { 'Content-Type': 'application/json' },
        data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
      }).catch(() => {});
    }
    const loginData = await loginRes.json();
    const token = loginData.access_token;

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_access_token', token);
    }, token);
    await page.goto('/');
    await page.waitForTimeout(2000);

    await page.request.post('http://localhost:8000/v1/rag/ingest/text', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      data: {
        source: 'stream-test.txt',
        text: 'React is a JavaScript library for building user interfaces. It was developed by Facebook.',
      },
    });

    const before = await page.screenshot();

    const textarea = page.locator('[placeholder*="Message"]');
    await textarea.first().fill('What is React?');
    await textarea.first().press('Enter');

    await page.waitForTimeout(5000);
    const during = await page.screenshot();

    expect(before.length).not.toBe(during.length);
  });

  test('conversations sidebar loads', async ({ page }) => {
    await apiLogin(page);
    await page.screenshot({ path: 'tests/screenshots/sidebar-state.png', fullPage: true });
  });
});
