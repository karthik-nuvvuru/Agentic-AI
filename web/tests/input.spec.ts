import { test, expect } from '@playwright/test';

test.describe('Input Area UX & Functionality', () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.post('http://localhost:8000/v1/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'test@example.com', password: 'testpass123' },
    });
    if (!res.ok()) {
      await page.request.post('http://localhost:8000/v1/auth/register', {
        headers: { 'Content-Type': 'application/json' },
        data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
      });
    }
    const data = await res.json();
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('auth_access_token', token), data.access_token);
    await page.goto('/');
    await page.waitForTimeout(1500);
  });

  test('sticky bottom input box remains visible', async ({ page }) => {
    const inputArea = page.locator('[placeholder*="Message"]');
    await expect(inputArea).toBeVisible();

    const initialPosition = await inputArea.boundingBox();
    expect(initialPosition).toBeTruthy();
  });

  test('auto-resize textarea based on content', async ({ page }) => {
    const textarea = page.locator('[placeholder*="Message"]');
    await expect(textarea).toBeVisible();

    await textarea.fill('Single line');
    const singleLineBox = await textarea.boundingBox();
    expect(singleLineBox).toBeTruthy();

    await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    const multiLineBox = await textarea.boundingBox();
    expect(multiLineBox).toBeTruthy();

    if (singleLineBox && multiLineBox) {
      expect(multiLineBox.height).toBeGreaterThanOrEqual(singleLineBox.height);
    }
  });

  test('auto-resize textarea max height constraint', async ({ page }) => {
    const textarea = page.locator('[placeholder*="Message"]');
    await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10');
    const box = await textarea.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      // Max height is 160px per the code
      expect(box.height).toBeLessThanOrEqual(170);
    }
  });

  test('submit button disabled when empty, enabled when text', async ({ page }) => {
    const sendButton = page.locator('[title="Send message"]');
    const textarea = page.locator('[placeholder*="Message"]');

    // Initially should be disabled
    await expect(sendButton.first()).toBeDisabled({ timeout: 8000 });

    await textarea.fill('Hello');
    await expect(sendButton.first()).toBeEnabled();
  });

  test('hint text provides clear guidance', async ({ page }) => {
    const hintText = page.locator('text=Press Enter to send');
    await expect(hintText.first()).toBeVisible();
  });

  test('focus state on input', async ({ page }) => {
    const textarea = page.locator('[placeholder*="Message"]');
    await expect(textarea).toBeVisible();

    await textarea.click();
    await page.waitForTimeout(100);

    const isFocused = await page.evaluate(() => {
      const el = document.querySelector('[placeholder*="Message"]');
      return el ? document.activeElement === el : false;
    });
    expect(isFocused).toBe(true);
  });
});
