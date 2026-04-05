# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat.spec.ts >> AI Chat App >> new chat button visible
- Location: tests/chat.spec.ts:66:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('text=New Chat').first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=New Chat').first()
    9 × locator resolved to <button tabindex="0" type="button" class="MuiButtonBase-root MuiButton-root MuiButton-outlined MuiButton-outlinedPrimary MuiButton-sizeMedium MuiButton-outlinedSizeMedium MuiButton-colorPrimary MuiButton-fullWidth MuiButton-root MuiButton-outlined MuiButton-outlinedPrimary MuiButton-sizeMedium MuiButton-outlinedSizeMedium MuiButton-colorPrimary MuiButton-fullWidth css-1ssggv-MuiButtonBase-root-MuiButton-root">…</button>
      - unexpected value "hidden"

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
      - button "T" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: T
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
  3   | // Helper: API login + set token in localStorage on correct origin
  4   | async function apiLogin(page: any, email = 'test@example.com', password = 'testpass123') {
  5   |   const res = await page.request.post('http://localhost:8000/v1/auth/login', {
  6   |     headers: { 'Content-Type': 'application/json' },
  7   |     data: { email, password },
  8   |   });
  9   |   expect(res.ok()).toBe(true);
  10  |   const data = await res.json();
  11  |   // Navigate to set origin, then store token
  12  |   await page.goto('/');
  13  |   await page.evaluate((token) => {
  14  |     localStorage.setItem('auth_access_token', token);
  15  |   }, data.access_token);
  16  |   // Navigate again so the app picks up the token
  17  |   await page.goto('/');
  18  |   await page.waitForTimeout(2000);
  19  |   return data.access_token;
  20  | }
  21  | 
  22  | test.describe('AI Chat App', () => {
  23  |   test.beforeEach(async ({ page }) => {
  24  |     await page.goto('/');
  25  |   });
  26  | 
  27  |   test('login page renders correctly', async ({ page }) => {
  28  |     await expect(page.locator('text=Agentic AI')).toBeVisible();
  29  |     await expect(page.locator('text=Welcome back')).toBeVisible();
  30  |     await expect(page.locator('text=Sign In').first()).toBeVisible();
  31  |     await expect(page.locator('text=Sign Up').first()).toBeVisible();
  32  |     await expect(page.locator('input[placeholder="you@example.com"]')).toBeVisible();
  33  |     await expect(page.locator('input[placeholder="Enter your password"]')).toBeVisible();
  34  |     await expect(page.locator('text=Google')).toBeVisible();
  35  |     await expect(page.locator('text=GitHub')).toBeVisible();
  36  |   });
  37  | 
  38  |   test('input fields have visible labels and borders', async ({ page }) => {
  39  |     const emailInput = page.locator('input[placeholder="you@example.com"]');
  40  |     await expect(emailInput).toBeVisible();
  41  |     const box = await emailInput.boundingBox();
  42  |     expect(box).not.toBeNull();
  43  |     expect(box!.width).toBeGreaterThan(100);
  44  |     expect(box!.height).toBeGreaterThan(20);
  45  | 
  46  |     const passwordInput = page.locator('input[placeholder="Enter your password"]');
  47  |     await expect(passwordInput).toBeVisible();
  48  |     const pwBox = await passwordInput.boundingBox();
  49  |     expect(pwBox).not.toBeNull();
  50  |     expect(pwBox!.height).toBeGreaterThan(20);
  51  |   });
  52  | 
  53  |   test('login with valid credentials redirects to main screen', async ({ page }) => {
  54  |     await page.locator('input[placeholder="you@example.com"]').fill('test@example.com');
  55  |     await page.locator('input[placeholder="Enter your password"]').fill('testpass123');
  56  |     await page.locator('button[type="submit"]').click();
  57  |     await page.waitForTimeout(3000);
  58  | 
  59  |     const hasHeader = await page.locator('text=Agentic AI').first().isVisible().catch(() => false);
  60  |     if (!hasHeader) {
  61  |       const errorMsg = await page.locator('text=Email').first().isVisible();
  62  |       expect(errorMsg).toBe(false);
  63  |     }
  64  |   });
  65  | 
  66  |   test('new chat button visible', async ({ page }) => {
  67  |     await apiLogin(page);
> 68  |     await expect(page.locator('text=New Chat').first()).toBeVisible();
      |                                                         ^ Error: expect(locator).toBeVisible() failed
  69  |   });
  70  | 
  71  |   test('sidebar visible on main screen', async ({ page }) => {
  72  |     await apiLogin(page);
  73  |     const screenshot = await page.screenshot();
  74  |     expect(screenshot.length).toBeGreaterThan(0);
  75  | 
  76  |     // Sidebar is a MuiStack-root on desktop with New Chat text
  77  |     const sidebarBox = await page.locator('button:has-text("New Chat")').first().boundingBox();
  78  |     expect(sidebarBox).not.toBeNull();
  79  | 
  80  |     const avatar = page.locator('text=T');
  81  |     await expect(avatar.first()).toBeVisible();
  82  |   });
  83  | 
  84  |   test('input area visible and usable on main screen', async ({ page }) => {
  85  |     await apiLogin(page);
  86  | 
  87  |     const textarea = page.locator('[placeholder*="Message"]');
  88  |     await expect(textarea.first()).toBeVisible();
  89  | 
  90  |     await textarea.first().fill('Hello, world!');
  91  |     await expect(textarea.first()).toHaveValue('Hello, world!');
  92  | 
  93  |     // Send button: find by title attribute
  94  |     const sendBtn = page.locator('[title="Send message"]');
  95  |     await expect(sendBtn).toBeVisible();
  96  |   });
  97  | 
  98  |   test('rag chat works end-to-end', async ({ page }) => {
  99  |     const loginRes = await page.request.post('http://localhost:8000/v1/auth/login', {
  100 |       headers: { 'Content-Type': 'application/json' },
  101 |       data: { email: 'test@example.com', password: 'testpass123' },
  102 |     });
  103 |     const loginData = await loginRes.json();
  104 |     const token = loginData.access_token;
  105 | 
  106 |     await page.goto('/');
  107 |     await page.evaluate((token) => {
  108 |       localStorage.setItem('auth_access_token', token);
  109 |     }, token);
  110 |     await page.goto('/');
  111 |     await page.waitForTimeout(2000);
  112 | 
  113 |     // Ingest test document
  114 |     await page.request.post('http://localhost:8000/v1/rag/ingest/text', {
  115 |       headers: {
  116 |         'Content-Type': 'application/json',
  117 |         'Authorization': `Bearer ${token}`,
  118 |       },
  119 |       data: {
  120 |         source: 'playwright-test.txt',
  121 |         text: 'Playwright is a testing framework for web browsers. It supports Chromium, Firefox, and WebKit.',
  122 |       },
  123 |     });
  124 | 
  125 |     // Type message and send
  126 |     const textarea = page.locator('[placeholder*="Message"]');
  127 |     await textarea.first().fill('What is Playwright?');
  128 |     await textarea.first().press('Enter');
  129 | 
  130 |     // Wait for streaming response to appear
  131 |     await page.waitForTimeout(8000);
  132 | 
  133 |     // Page should have changed from streaming or showing response
  134 |     const pageContent = await page.content();
  135 |     expect(pageContent.length).toBeGreaterThan(100);
  136 |   });
  137 | 
  138 |   test('streaming response shows content progressively', async ({ page }) => {
  139 |     const loginRes = await page.request.post('http://localhost:8000/v1/auth/login', {
  140 |       headers: { 'Content-Type': 'application/json' },
  141 |       data: { email: 'test@example.com', password: 'testpass123' },
  142 |     });
  143 |     const loginData = await loginRes.json();
  144 |     const token = loginData.access_token;
  145 | 
  146 |     await page.goto('/');
  147 |     await page.evaluate((token) => {
  148 |       localStorage.setItem('auth_access_token', token);
  149 |     }, token);
  150 |     await page.goto('/');
  151 |     await page.waitForTimeout(2000);
  152 | 
  153 |     await page.request.post('http://localhost:8000/v1/rag/ingest/text', {
  154 |       headers: {
  155 |         'Content-Type': 'application/json',
  156 |         'Authorization': `Bearer ${token}`,
  157 |       },
  158 |       data: {
  159 |         source: 'stream-test.txt',
  160 |         text: 'React is a JavaScript library for building user interfaces. It was developed by Facebook.',
  161 |       },
  162 |     });
  163 | 
  164 |     const before = await page.screenshot();
  165 | 
  166 |     const textarea = page.locator('[placeholder*="Message"]');
  167 |     await textarea.first().fill('What is React?');
  168 |     await textarea.first().press('Enter');
```