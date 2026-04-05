# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux.spec.ts >> UX Quality Tests >> accessibility - text elements are styled with proper colors
- Location: tests/ux.spec.ts:78:3

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[placeholder*="Message"]')

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | async function apiLoginAndGo(page: any) {
  4   |   let res = await page.request.post('http://localhost:8000/v1/auth/login', {
  5   |     headers: { 'Content-Type': 'application/json' },
  6   |     data: { email: 'test@example.com', password: 'testpass123' },
  7   |   });
  8   |   if (!res.ok()) {
  9   |     await page.request.post('http://localhost:8000/v1/auth/register', {
  10  |       headers: { 'Content-Type': 'application/json' },
  11  |       data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
  12  |     }).catch(() => {});
  13  |     res = await page.request.post('http://localhost:8000/v1/auth/login', {
  14  |       headers: { 'Content-Type': 'application/json' },
  15  |       data: { email: 'test@example.com', password: 'testpass123' },
  16  |     });
  17  |   }
  18  |   const data = await res.json();
  19  |   await page.goto('/');
  20  |   await page.evaluate((token) => localStorage.setItem('auth_access_token', token), data.access_token);
  21  |   await page.goto('/');
  22  |   await page.waitForTimeout(500);
  23  | }
  24  | 
  25  | test.describe('UX Quality Tests', () => {
  26  |   test('responsive design - mobile viewport works correctly', async ({ page }) => {
  27  |     await page.setViewportSize({ width: 375, height: 667 });
  28  |     await apiLoginAndGo(page);
  29  |     await page.waitForTimeout(300);
  30  | 
  31  |     await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
  32  |     await expect(page.locator('[title="Send message"]')).toBeVisible();
  33  | 
  34  |     const input = page.locator('[placeholder*="Message"]');
  35  |     await input.fill('Mobile test');
  36  |     await expect(input).toHaveValue('Mobile test');
  37  | 
  38  |     await page.screenshot({ path: 'test-results/mobile-viewport.png' });
  39  |   });
  40  | 
  41  |   test('responsive design - tablet viewport works correctly', async ({ page }) => {
  42  |     await page.setViewportSize({ width: 768, height: 1024 });
  43  |     await apiLoginAndGo(page);
  44  |     await page.waitForTimeout(300);
  45  | 
  46  |     await expect(page.locator('button:has-text("New Chat")').first()).toBeVisible();
  47  |     const input = page.locator('[placeholder*="Message"]');
  48  |     await expect(input).toBeVisible();
  49  | 
  50  |     await page.screenshot({ path: 'test-results/tablet-viewport.png' });
  51  |   });
  52  | 
  53  |   test('visual hierarchy - important elements have proper prominence', async ({ page }) => {
  54  |     await apiLoginAndGo(page);
  55  | 
  56  |     const input = page.locator('[placeholder*="Message"]');
  57  |     const sendButton = page.locator('[title="Send message"]');
  58  |     const hintText = page.locator('text=Press Enter to send');
  59  | 
  60  |     await expect(input).toBeVisible();
  61  |     await expect(sendButton).toBeVisible();
  62  |     await expect(hintText.first()).toBeVisible();
  63  |   });
  64  | 
  65  |   test('consistent spacing and alignment throughout UI', async ({ page }) => {
  66  |     await apiLoginAndGo(page);
  67  | 
  68  |     const input = page.locator('[placeholder*="Message"]');
  69  |     await expect(input).toBeVisible();
  70  | 
  71  |     const inputBox = await input.boundingBox();
  72  |     expect(inputBox).toBeTruthy();
  73  |     if (inputBox) {
  74  |       expect(inputBox.width).toBeGreaterThan(200);
  75  |     }
  76  |   });
  77  | 
  78  |   test('accessibility - text elements are styled with proper colors', async ({ page }) => {
  79  |     await apiLoginAndGo(page);
  80  | 
  81  |     const input = page.locator('[placeholder*="Message"]');
> 82  |     await input.fill('Accessibility test');
      |                 ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
  83  |     await input.press('Enter');
  84  |     await page.waitForTimeout(2000);
  85  | 
  86  |     const hasText = await page.locator('text=Accessibility test').isVisible().catch(() => false);
  87  |     expect(hasText).toBe(true);
  88  |   });
  89  | 
  90  |   test('error states are handled gracefully with user feedback', async ({ page }) => {
  91  |     await apiLoginAndGo(page);
  92  | 
  93  |     const input = page.locator('[placeholder*="Message"]');
  94  | 
  95  |     // Pressing Enter with empty input should not crash
  96  |     await input.press('Enter');
  97  |     await page.waitForTimeout(500);
  98  |     await expect(input).toBeVisible();
  99  | 
  100 |     // Type something and verify UI is still usable
  101 |     await input.fill('Recovery test');
  102 |     await expect(input).toHaveValue('Recovery test');
  103 |   });
  104 | });
  105 | 
```