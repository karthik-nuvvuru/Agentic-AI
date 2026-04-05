# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo.spec.ts >> Demo: Full UX Flow >> 4. Full layout: header, input, and features
- Location: tests/demo.spec.ts:80:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Ask me anything')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Ask me anything')

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
  3   | const API = 'http://localhost:8000';
  4   | const WEB = 'http://localhost:3000';
  5   | 
  6   | // Helper: register or login via API, inject token, navigate to app
  7   | async function setupUser(page: any, email: string, password: string, name: string) {
  8   |   // Try register; if exists, login via a separate call
  9   |   let data: any;
  10  |   const regRes = await page.request.post(`${API}/v1/auth/register`, {
  11  |     headers: { 'Content-Type': 'application/json' },
  12  |     data: { email, password, name },
  13  |   });
  14  |   if (regRes.ok()) {
  15  |     data = await regRes.json();
  16  |   } else {
  17  |     // Already exists - login
  18  |     const loginRes = await page.request.post(`${API}/v1/auth/login`, {
  19  |       headers: { 'Content-Type': 'application/json' },
  20  |       data: { email, password },
  21  |     });
  22  |     expect(loginRes.ok()).toBe(true);
  23  |     data = await loginRes.json();
  24  |   }
  25  | 
  26  |   await page.goto(WEB);
  27  |   await page.evaluate((token: string) => localStorage.setItem('auth_access_token', token), data.access_token);
  28  |   await page.goto(WEB);
  29  |   await page.waitForTimeout(1500);
  30  | }
  31  | 
  32  | test.describe('Demo: Full UX Flow', () => {
  33  |   const testUserEmail = `e2e-${Date()}@test.com`.replace(/[^a-z0-9@.]/g, '');
  34  |   const testUserPass = 'demopass123';
  35  |   const testUserName = 'E2E Demo';
  36  | 
  37  |   test('1. Login screen renders', async ({ page }) => {
  38  |     await page.goto(WEB);
  39  |     await page.waitForTimeout(1000);
  40  | 
  41  |     // Auth screen: check title and input fields
  42  |     await expect(page.getByText('Agentic AI').first()).toBeVisible();
  43  |     await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  44  |     await expect(page.getByPlaceholder('Enter your password', { exact: true })).toBeVisible();
  45  | 
  46  |     await page.screenshot({ path: 'tests/screenshots/01-login-screen.png', fullPage: true });
  47  |     console.log('Screenshot 1: Login screen');
  48  |   });
  49  | 
  50  |   test('2. Register and see welcome screen', async ({ page }) => {
  51  |     await setupUser(page, testUserEmail, testUserPass, testUserName);
  52  | 
  53  |     // Login form should NOT be visible
  54  |     const loginVisible = await page.getByPlaceholder('you@example.com').isVisible().catch(() => false);
  55  |     expect(loginVisible).toBe(false);
  56  | 
  57  |     // Welcome screen with ChatGPT-style layout
  58  |     await expect(page.getByText('Ask me anything')).toBeVisible();
  59  |     await expect(page.getByPlaceholder(/Message/)).toBeVisible();
  60  | 
  61  |     await page.screenshot({ path: 'tests/screenshots/02-welcome-screen.png', fullPage: true });
  62  |     console.log('Screenshot 2: Welcome screen');
  63  |   });
  64  | 
  65  |   test('3. Sidebar shows conversations', async ({ page }) => {
  66  |     await setupUser(page, testUserEmail, testUserPass, testUserName);
  67  |     await page.waitForTimeout(2000);
  68  | 
  69  |     // "Today" group label should appear
  70  |     const todayVisible = await page.getByText('Today').first().isVisible().catch(() => false);
  71  |     expect(todayVisible).toBe(true);
  72  | 
  73  |     // Sidebar search should be visible
  74  |     await expect(page.getByPlaceholder('Search').first()).toBeVisible();
  75  | 
  76  |     await page.screenshot({ path: 'tests/screenshots/03-sidebar-convs.png', fullPage: true });
  77  |     console.log('Screenshot 3: Sidebar with conversations');
  78  |   });
  79  | 
  80  |   test('4. Full layout: header, input, and features', async ({ page }) => {
  81  |     await setupUser(page, testUserEmail, testUserPass, testUserName);
  82  |     await page.waitForTimeout(2000);
  83  | 
  84  |     // Verify the app is fully rendered (no login screen)
> 85  |     await expect(page.getByText('Ask me anything')).toBeVisible({ timeout: 5000 });
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  86  | 
  87  |     // Bottom input area
  88  |     await expect(page.getByPlaceholder(/Message/)).toBeVisible();
  89  |     await expect(page.getByText('Press Enter to send')).toBeVisible();
  90  | 
  91  |     // Quick questions on welcome screen
  92  |     await expect(page.getByText('Try asking')).toBeVisible();
  93  | 
  94  |     // Feature cards
  95  |     await expect(page.getByText('Upload documents')).toBeVisible();
  96  |     await expect(page.getByText('Smart search')).toBeVisible();
  97  |     await expect(page.getByText('Follow-ups')).toBeVisible();
  98  | 
  99  |     // Bottom input area
  100 |     await expect(page.getByPlaceholder(/Message/)).toBeVisible();
  101 |     await expect(page.getByText('Press Enter to send')).toBeVisible();
  102 | 
  103 |     // Quick questions on welcome screen
  104 |     await expect(page.getByText('Try asking')).toBeVisible();
  105 | 
  106 |     await page.screenshot({ path: 'tests/screenshots/04-full-layout.png', fullPage: true });
  107 |     console.log('Screenshot 4: Full layout');
  108 |   });
  109 | 
  110 |   test('5. Send chat message and see streaming response', async ({ page }) => {
  111 |     await setupUser(page, testUserEmail, testUserPass, testUserName);
  112 |     await page.waitForTimeout(2000);
  113 | 
  114 |     // Type a message
  115 |     const input = page.getByPlaceholder(/Message/);
  116 |     await expect(input).toBeVisible();
  117 |     await input.fill('What is agentic AI?');
  118 |     await page.waitForTimeout(300);
  119 | 
  120 |     // Get conversation count before
  121 |     const convCountBefore = await page.getByText('Today').count();
  122 | 
  123 |     // Send via Enter key
  124 |     await input.press('Enter');
  125 |     await page.waitForTimeout(5000);
  126 | 
  127 |     // Should see the user message in chat
  128 |     const msgVisible = await page.getByText('What is agentic AI?').isVisible().catch(() => false);
  129 |     expect(msgVisible).toBe(true);
  130 | 
  131 |     await page.screenshot({ path: 'tests/screenshots/05-chat-response.png', fullPage: true });
  132 |     console.log('Screenshot 5: Chat with response');
  133 |   });
  134 | });
  135 | 
```