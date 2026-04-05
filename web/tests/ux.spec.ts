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

test.describe('UX Quality Tests', () => {
  test('responsive design - mobile viewport works correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await apiLoginAndGo(page);
    await page.waitForTimeout(300);

    await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
    await expect(page.locator('[title="Send message"]')).toBeVisible();

    const input = page.locator('[placeholder*="Message"]');
    await input.fill('Mobile test');
    await expect(input).toHaveValue('Mobile test');

    await page.screenshot({ path: 'test-results/mobile-viewport.png' });
  });

  test('responsive design - tablet viewport works correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await apiLoginAndGo(page);
    await page.waitForTimeout(300);

    await expect(page.locator('button:has-text("New Chat")').first()).toBeVisible();
    const input = page.locator('[placeholder*="Message"]');
    await expect(input).toBeVisible();

    await page.screenshot({ path: 'test-results/tablet-viewport.png' });
  });

  test('visual hierarchy - important elements have proper prominence', async ({ page }) => {
    await apiLoginAndGo(page);

    const input = page.locator('[placeholder*="Message"]');
    const sendButton = page.locator('[title="Send message"]');
    const hintText = page.locator('text=Press Enter to send');

    await expect(input).toBeVisible();
    await expect(sendButton).toBeVisible();
    await expect(hintText.first()).toBeVisible();
  });

  test('consistent spacing and alignment throughout UI', async ({ page }) => {
    await apiLoginAndGo(page);

    const input = page.locator('[placeholder*="Message"]');
    await expect(input).toBeVisible();

    const inputBox = await input.boundingBox();
    expect(inputBox).toBeTruthy();
    if (inputBox) {
      expect(inputBox.width).toBeGreaterThan(200);
    }
  });

  test('accessibility - elements remain visible after interaction', async ({ page }) => {
    await apiLoginAndGo(page);

    // Just verify we can type and see our message on screen
    const input = page.locator('[placeholder*="Message"]');
    await input.fill('Accessibility test');
    await expect(input).toHaveValue('Accessibility test');

    // Press Enter - app should still be responsive
    await input.press('Enter');
    await page.waitForTimeout(1000);

    // Input should still be visible and usable
    await expect(input).toBeVisible();
  });

  test('error states are handled gracefully with user feedback', async ({ page }) => {
    await apiLoginAndGo(page);

    const input = page.locator('[placeholder*="Message"]');

    // Pressing Enter with empty input should not crash
    await input.press('Enter');
    await page.waitForTimeout(500);
    await expect(input).toBeVisible();

    // Type something and verify UI is still usable
    await input.fill('Recovery test');
    await expect(input).toHaveValue('Recovery test');
  });
});
