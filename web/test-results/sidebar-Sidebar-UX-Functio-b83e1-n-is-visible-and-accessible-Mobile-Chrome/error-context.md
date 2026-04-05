# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sidebar.spec.ts >> Sidebar UX & Functionality >> new chat button is visible and accessible
- Location: tests/sidebar.spec.ts:26:3

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
  22 |   await page.waitForTimeout(1500);
  23 | }
  24 | 
  25 | test.describe('Sidebar UX & Functionality', () => {
  26 |   test('new chat button is visible and accessible', async ({ page }) => {
  27 |     await apiLoginAndGo(page);
  28 | 
  29 |     const newChatBtn = page.locator('button:has-text("New Chat")');
> 30 |     await expect(newChatBtn.first()).toBeVisible();
     |                                      ^ Error: expect(locator).toBeVisible() failed
  31 | 
  32 |     const box = await newChatBtn.first().boundingBox();
  33 |     expect(box).toBeTruthy();
  34 |     if (box) {
  35 |       expect(box.width).toBeGreaterThanOrEqual(40);
  36 |       expect(box.height).toBeGreaterThanOrEqual(36);
  37 |     }
  38 |   });
  39 | 
  40 |   test('sidebar search input is visible and usable', async ({ page }) => {
  41 |     await apiLoginAndGo(page);
  42 | 
  43 |     // Check the New Chat button exists instead (data-testid may not be present)
  44 |     await expect(page.locator('button:has-text("New Chat")').first()).toBeVisible();
  45 |   });
  46 | });
  47 | 
```