# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui.spec.ts >> AI Chat App >> sidebar visible on main screen
- Location: tests/ui.spec.ts:79:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('text=T').first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=T').first()
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
  28  |     // Should show login screen (not main chat)
  29  |     await expect(page.locator('text=Agentic AI')).toBeVisible();
  30  |     await expect(page.locator('text=Welcome back')).toBeVisible();
  31  | 
  32  |     // Tab toggle should be visible
  33  |     await expect(page.locator('text=Sign In').first()).toBeVisible();
  34  |     await expect(page.locator('text=Sign Up').first()).toBeVisible();
  35  | 
  36  |     // Form fields
  37  |     await expect(page.locator('input[placeholder="you@example.com"]')).toBeVisible();
  38  |     await expect(page.locator('input[placeholder="Enter your password"]')).toBeVisible();
  39  | 
  40  |     // Social login buttons
  41  |     await expect(page.locator('text=Google')).toBeVisible();
  42  |     await expect(page.locator('text=GitHub')).toBeVisible();
  43  |   });
  44  | 
  45  |   test('input fields have visible labels and borders', async ({ page }) => {
  46  |     const emailInput = page.locator('input[placeholder="you@example.com"]');
  47  |     await expect(emailInput).toBeVisible();
  48  |     const box = await emailInput.boundingBox();
  49  |     expect(box).not.toBeNull();
  50  |     expect(box!.width).toBeGreaterThan(100);
  51  |     expect(box!.height).toBeGreaterThan(20);
  52  | 
  53  |     const passwordInput = page.locator('input[placeholder="Enter your password"]');
  54  |     await expect(passwordInput).toBeVisible();
  55  |     const pwBox = await passwordInput.boundingBox();
  56  |     expect(pwBox).not.toBeNull();
  57  |     expect(pwBox!.height).toBeGreaterThan(20);
  58  |   });
  59  | 
  60  |   test('login with valid credentials redirects to main screen', async ({ page }) => {
  61  |     await page.locator('input[placeholder="you@example.com"]').fill('test@example.com');
  62  |     await page.locator('input[placeholder="Enter your password"]').fill('testpass123');
  63  |     await page.locator('button[type="submit"]').click();
  64  |     await page.waitForTimeout(3000);
  65  | 
  66  |     const hasHeader = await page.locator('text=Agentic AI').first().isVisible().catch(() => false);
  67  |     if (!hasHeader) {
  68  |       const errorMsg = await page.locator('text=Email').first().isVisible();
  69  |       expect(errorMsg).toBe(false);
  70  |     }
  71  |   });
  72  | 
  73  |   test('new chat button visible', async ({ page }) => {
  74  |     await apiLogin(page);
  75  |     // Should see sidebar with New Chat button
  76  |     await expect(page.locator('text=New Chat').first()).toBeVisible();
  77  |   });
  78  | 
  79  |   test('sidebar visible on main screen', async ({ page }) => {
  80  |     await apiLogin(page);
  81  |     const screenshot = await page.screenshot();
  82  | 
  83  |     const sidebarBox = await page.locator('.MuiStack-root').first().boundingBox();
  84  |     expect(sidebarBox).not.toBeNull();
  85  |     expect(sidebarBox!.width).toBeGreaterThan(200);
  86  | 
  87  |     const avatar = page.locator('text=T');
> 88  |     await expect(avatar.first()).toBeVisible();
      |                                  ^ Error: expect(locator).toBeVisible() failed
  89  |   });
  90  | 
  91  |   test('input area visible and usable on main screen', async ({ page }) => {
  92  |     await apiLogin(page);
  93  | 
  94  |     const textarea = page.locator('[placeholder*="Message"]');
  95  |     await expect(textarea.first()).toBeVisible();
  96  | 
  97  |     await textarea.first().fill('Hello, world!');
  98  |     await expect(textarea.first()).toHaveValue('Hello, world!');
  99  | 
  100 |     // Send button: find by title attribute
  101 |     const sendBtn = page.getByRole('button', { name: 'Send message' });
  102 |     await expect(sendBtn).toBeVisible();
  103 |   });
  104 | 
  105 |   test('rag chat works end-to-end', async ({ page }) => {
  106 |     const loginRes = await page.request.post('http://localhost:8000/v1/auth/login', {
  107 |       headers: { 'Content-Type': 'application/json' },
  108 |       data: { email: 'test@example.com', password: 'testpass123' },
  109 |     });
  110 |     const loginData = await loginRes.json();
  111 |     const token = loginData.access_token;
  112 | 
  113 |     // Set token on correct origin
  114 |     await page.goto('/');
  115 |     await page.evaluate((token) => {
  116 |       localStorage.setItem('auth_access_token', token);
  117 |     }, token);
  118 |     await page.goto('/');
  119 |     await page.waitForTimeout(2000);
  120 | 
  121 |     // Ingest test document
  122 |     await page.request.post('http://localhost:8000/v1/rag/ingest/text', {
  123 |       headers: {
  124 |         'Content-Type': 'application/json',
  125 |         'Authorization': `Bearer ${token}`,
  126 |       },
  127 |       data: {
  128 |         source: 'playwright-test.txt',
  129 |         text: 'Playwright is a testing framework for web browsers. It supports Chromium, Firefox, and WebKit.',
  130 |       },
  131 |     });
  132 | 
  133 |     // Type message and send
  134 |     const textarea = page.locator('[placeholder*="Message"]');
  135 |     await textarea.first().fill('What is Playwright?');
  136 |     await textarea.first().press('Enter');
  137 | 
  138 |     // Wait for streaming response to appear
  139 |     await page.waitForTimeout(5000);
  140 | 
  141 |     const pageContent = await page.content();
  142 |     expect(pageContent.length).toBeGreaterThan(100);
  143 |   });
  144 | 
  145 |   test('streaming response shows content progressively', async ({ page }) => {
  146 |     // Login
  147 |     const loginRes = await page.request.post('http://localhost:8000/v1/auth/login', {
  148 |       headers: { 'Content-Type': 'application/json' },
  149 |       data: { email: 'test@example.com', password: 'testpass123' },
  150 |     });
  151 |     const loginData = await loginRes.json();
  152 |     const token = loginData.access_token;
  153 | 
  154 |     // Set token
  155 |     await page.goto('/');
  156 |     await page.evaluate((token) => {
  157 |       localStorage.setItem('auth_access_token', token);
  158 |     }, token);
  159 |     await page.goto('/');
  160 |     await page.waitForTimeout(2000);
  161 | 
  162 |     // Ingest data
  163 |     await page.request.post('http://localhost:8000/v1/rag/ingest/text', {
  164 |       headers: {
  165 |         'Content-Type': 'application/json',
  166 |         'Authorization': `Bearer ${token}`,
  167 |       },
  168 |       data: {
  169 |         source: 'stream-test.txt',
  170 |         text: 'React is a JavaScript library for building user interfaces. It was developed by Facebook.',
  171 |       },
  172 |     });
  173 | 
  174 |     // Take screenshot before action
  175 |     const before = await page.screenshot();
  176 | 
  177 |     // Send a message
  178 |     const textarea = page.locator('[placeholder*="Message"]');
  179 |     await textarea.first().fill('What is React?');
  180 |     await textarea.first().press('Enter');
  181 | 
  182 |     // Check streaming appears after 3 seconds
  183 |     await page.waitForTimeout(3000);
  184 | 
  185 |     // Take screenshot during streaming
  186 |     const during = await page.screenshot();
  187 | 
  188 |     expect(before.length).not.toBe(during.length);
```