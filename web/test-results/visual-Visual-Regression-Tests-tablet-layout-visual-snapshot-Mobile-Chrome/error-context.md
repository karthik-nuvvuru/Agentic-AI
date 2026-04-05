# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.ts >> Visual Regression Tests >> tablet layout visual snapshot
- Location: tests/visual.spec.ts:67:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("New Chat")').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("New Chat")').first()

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - paragraph [ref=e9]: Agentic AI
    - paragraph [ref=e10]: Welcome back — sign in to continue
  - generic [ref=e11]:
    - generic [ref=e12]:
      - button "Sign In" [ref=e13] [cursor=pointer]
      - button "Sign Up" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - generic: Name
      - generic [ref=e16]:
        - generic [ref=e17]: Email
        - generic [ref=e18]:
          - img [ref=e20]
          - textbox "Email" [ref=e22]:
            - /placeholder: you@example.com
          - group:
            - generic: Email
      - generic [ref=e23]:
        - generic [ref=e24]: Password
        - generic [ref=e25]:
          - img [ref=e27]
          - textbox "Password" [ref=e29]:
            - /placeholder: Enter your password
          - button [ref=e31] [cursor=pointer]:
            - img [ref=e32]
          - group:
            - generic: Password
      - button "Sign In" [ref=e34] [cursor=pointer]
    - paragraph [ref=e37]: or continue with
    - generic [ref=e39]:
      - button "Google" [ref=e40] [cursor=pointer]:
        - img [ref=e42]
        - text: Google
      - button "GitHub" [ref=e47] [cursor=pointer]:
        - img [ref=e48]
        - text: GitHub
  - paragraph [ref=e51]: Don't have an account? Sign up
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | async function apiLoginAndGo(page: any) {
  4  |   let res = await page.request.post('http://localhost:8000/v1/auth/login', {
  5  |     headers: { 'Content-Type': 'application/json' },
  6  |     data: { email: 'test@example.com', password: 'testpass123' },
  7  |   });
  8  |   if (!res.ok()) {
  9  |     await page.request.post('http://localhost:8000/v1/auth/register', {
  10 |       headers: { 'Content-Type': 'application/json' },
  11 |       data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
  12 |     }).catch(() => {});
  13 |     res = await page.request.post('http://localhost:8000/v1/auth/login', {
  14 |       headers: { 'Content-Type': 'application/json' },
  15 |       data: { email: 'test@example.com', password: 'testpass123' },
  16 |     });
  17 |   }
  18 |   const data = await res.json();
  19 |   await page.goto('/');
  20 |   await page.evaluate((token) => localStorage.setItem('auth_access_token', token), data.access_token);
  21 |   await page.goto('/');
  22 |   await page.waitForTimeout(500);
  23 | }
  24 | 
  25 | test.describe('Visual Regression Tests', () => {
  26 |   test.beforeEach(async ({ page }) => {
  27 |     await apiLoginAndGo(page);
  28 |   });
  29 | 
  30 |   test('welcome screen visual snapshot', async ({ page }) => {
  31 |     await expect(page.locator('text=Ask me anything')).toBeVisible();
  32 |     await expect(page.locator('text=Upload your documents')).toBeVisible({ timeout: 5000 }).catch(() => {});
  33 |     await page.screenshot({ path: 'tests/screenshots/visual-welcome.png' });
  34 |   });
  35 | 
  36 |   test('chat interface visual snapshot', async ({ page }) => {
  37 |     const input = page.locator('[placeholder*="Message"]');
  38 |     await input.fill('Hello world');
  39 |     await input.press('Enter');
  40 |     await page.waitForTimeout(2000);
  41 | 
  42 |     await expect(page.locator('text=Hello world')).toBeVisible();
  43 |     await page.screenshot({ path: 'tests/screenshots/visual-message.png' });
  44 |   });
  45 | 
  46 |   test('input area visual snapshot', async ({ page }) => {
  47 |     await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
  48 |     await expect(page.locator('[title="Send message"]')).toBeVisible();
  49 |     await expect(page.locator('[title="Attach files"]')).toBeVisible();
  50 |   });
  51 | 
  52 |   test('mobile layout visual snapshot', async ({ page }) => {
  53 |     await page.setViewportSize({ width: 375, height: 667 });
  54 |     await page.reload();
  55 |     await page.waitForTimeout(500);
  56 | 
  57 |     // On mobile with auth, should see hamburger menu icon
  58 |     await expect(page.locator('[aria-label="Open navigation"]').or(page.locator('h2').filter({ hasText: 'Agentic AI' }))).toBeVisible();
  59 |   });
  60 | 
  61 |   test('tablet layout visual snapshot', async ({ page }) => {
  62 |     await page.setViewportSize({ width: 768, height: 1024 });
  63 |     await page.reload();
  64 |     await page.waitForTimeout(1000);
  65 | 
  66 |     await expect(page.locator('button:has-text("New Chat")').first()).toBeVisible();
  67 |     await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
  68 |   });
  69 | 
  70 |   test('hover states visual snapshot', async ({ page }) => {
  71 |     const input = page.locator('[placeholder*="Message"]');
> 72 |     await input.fill('Hover test');
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  73 |     await input.press('Enter');
  74 |     await page.waitForTimeout(2000);
  75 | 
  76 |     await expect(page.locator('[title="Send message"]')).toBeVisible();
  77 |   });
  78 | });
  79 | 
```