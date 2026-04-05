# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo.spec.ts >> Demo: Full UX Flow >> 3. Sidebar shows conversations
- Location: tests/demo.spec.ts:65:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - button [ref=e7] [cursor=pointer]:
      - img [ref=e8]
    - paragraph [ref=e11]: New Chat
    - generic [ref=e12]:
      - button "Light mode" [ref=e13] [cursor=pointer]:
        - img [ref=e14]
      - button "Upload files" [ref=e16] [cursor=pointer]:
        - img [ref=e17]
      - button "E" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: E
  - generic [ref=e23]:
    - img [ref=e25]
    - paragraph [ref=e29]: Ask me anything
    - paragraph [ref=e30]: Upload your documents and ask questions. Get intelligent, source-attributed answers powered by RAG.
    - generic [ref=e31]:
      - generic [ref=e32]:
        - img [ref=e34]
        - paragraph [ref=e36]: Upload documents
        - paragraph [ref=e37]: PDF, TXT, MD, CSV
      - generic [ref=e38]:
        - img [ref=e40]
        - paragraph [ref=e42]: Smart search
        - paragraph [ref=e43]: Vector + keyword RAG
      - generic [ref=e44]:
        - img [ref=e46]
        - paragraph [ref=e48]: Follow-ups
        - paragraph [ref=e49]: Stay in context
    - paragraph [ref=e50]: Try asking
    - generic [ref=e51]:
      - generic [ref=e52] [cursor=pointer]:
        - generic [ref=e53]: 📄
        - paragraph [ref=e54]: Summarize the key points from the uploaded document
      - generic [ref=e55] [cursor=pointer]:
        - generic [ref=e56]: 🔍
        - paragraph [ref=e57]: What are the main topics covered in my files?
      - generic [ref=e58] [cursor=pointer]:
        - generic [ref=e59]: ⚖️
        - paragraph [ref=e60]: Compare and contrast the findings
      - generic [ref=e61] [cursor=pointer]:
        - generic [ref=e62]: 💡
        - paragraph [ref=e63]: What conclusions can be drawn?
  - generic [ref=e66]:
    - generic [ref=e68]:
      - button "Attach files" [ref=e69] [cursor=pointer]:
        - img [ref=e70]
      - textbox "Message Agentic AI\\u2026" [ref=e74]
      - button "Send message" [disabled]:
        - img
    - paragraph [ref=e75]: Press Enter to send, Shift+Enter for new line
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
> 71  |     expect(todayVisible).toBe(true);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
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
  85  |     await expect(page.getByText('Ask me anything')).toBeVisible({ timeout: 5000 });
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