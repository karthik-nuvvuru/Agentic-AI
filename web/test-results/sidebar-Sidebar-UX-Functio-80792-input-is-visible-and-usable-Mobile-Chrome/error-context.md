# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sidebar.spec.ts >> Sidebar UX & Functionality >> sidebar search input is visible and usable
- Location: tests/sidebar.spec.ts:40:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('button:has-text("New Chat")').first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("New Chat")').first()
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
  30 |     await expect(newChatBtn.first()).toBeVisible();
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
> 44 |     await expect(page.locator('button:has-text("New Chat")').first()).toBeVisible();
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  45 |   });
  46 | });
  47 | 
```