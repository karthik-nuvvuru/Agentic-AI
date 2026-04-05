import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('quick initial render and interaction', async ({ page }) => {
    const navStart = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - navStart;
    expect(loadTime).toBeLessThan(5000);

    // Should see login form
    await expect(page.locator('text=Agentic AI')).toBeVisible();
  });

  test('login flow is responsive', async ({ page }) => {
    await page.goto('/');
    const interactionStart = Date.now();
    await page.locator('input[placeholder="you@example.com"]').fill('test@example.com');
    await page.locator('input[placeholder="Enter your password"]').fill('testpass123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Should redirect to main screen
    const interactionTime = Date.now() - interactionStart;
    expect(interactionTime).toBeLessThan(3000);
  });
});
