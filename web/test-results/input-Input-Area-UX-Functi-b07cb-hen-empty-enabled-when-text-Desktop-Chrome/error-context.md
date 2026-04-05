# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: input.spec.ts >> Input Area UX & Functionality >> submit button disabled when empty, enabled when text
- Location: tests/input.spec.ts:58:3

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: locator('[title="Send message"]').first()
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" with timeout 5000ms
  - waiting for locator('[title="Send message"]').first()

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
  3  | test.describe('Input Area UX & Functionality', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     const res = await page.request.post('http://localhost:8000/v1/auth/login', {
  6  |       headers: { 'Content-Type': 'application/json' },
  7  |       data: { email: 'test@example.com', password: 'testpass123' },
  8  |     });
  9  |     if (!res.ok()) {
  10 |       await page.request.post('http://localhost:8000/v1/auth/register', {
  11 |         headers: { 'Content-Type': 'application/json' },
  12 |         data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
  13 |       });
  14 |     }
  15 |     const data = await res.json();
  16 |     await page.goto('/');
  17 |     await page.evaluate((token) => localStorage.setItem('auth_access_token', token), data.access_token);
  18 |     await page.goto('/');
  19 |     await page.waitForTimeout(1500);
  20 |   });
  21 | 
  22 |   test('sticky bottom input box remains visible', async ({ page }) => {
  23 |     const inputArea = page.locator('[placeholder*="Message"]');
  24 |     await expect(inputArea).toBeVisible();
  25 | 
  26 |     const initialPosition = await inputArea.boundingBox();
  27 |     expect(initialPosition).toBeTruthy();
  28 |   });
  29 | 
  30 |   test('auto-resize textarea based on content', async ({ page }) => {
  31 |     const textarea = page.locator('[placeholder*="Message"]');
  32 |     await expect(textarea).toBeVisible();
  33 | 
  34 |     await textarea.fill('Single line');
  35 |     const singleLineBox = await textarea.boundingBox();
  36 |     expect(singleLineBox).toBeTruthy();
  37 | 
  38 |     await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
  39 |     const multiLineBox = await textarea.boundingBox();
  40 |     expect(multiLineBox).toBeTruthy();
  41 | 
  42 |     if (singleLineBox && multiLineBox) {
  43 |       expect(multiLineBox.height).toBeGreaterThanOrEqual(singleLineBox.height);
  44 |     }
  45 |   });
  46 | 
  47 |   test('auto-resize textarea max height constraint', async ({ page }) => {
  48 |     const textarea = page.locator('[placeholder*="Message"]');
  49 |     await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10');
  50 |     const box = await textarea.boundingBox();
  51 |     expect(box).toBeTruthy();
  52 |     if (box) {
  53 |       // Max height is 160px per the code
  54 |       expect(box.height).toBeLessThanOrEqual(170);
  55 |     }
  56 |   });
  57 | 
  58 |   test('submit button disabled when empty, enabled when text', async ({ page }) => {
  59 |     const sendButton = page.locator('[title="Send message"]');
  60 |     const textarea = page.locator('[placeholder*="Message"]');
  61 | 
  62 |     // Initially should be disabled
> 63 |     await expect(sendButton.first()).toBeDisabled();
     |                                      ^ Error: expect(locator).toBeDisabled() failed
  64 | 
  65 |     await textarea.fill('Hello');
  66 |     await expect(sendButton.first()).toBeEnabled();
  67 | 
  68 |     await textarea.fill('');
  69 |     await expect(sendButton.first()).toBeDisabled();
  70 |   });
  71 | 
  72 |   test('hint text provides clear guidance', async ({ page }) => {
  73 |     const hintText = page.locator('text=Press Enter to send');
  74 |     await expect(hintText.first()).toBeVisible();
  75 |   });
  76 | 
  77 |   test('focus state on input', async ({ page }) => {
  78 |     const textarea = page.locator('[placeholder*="Message"]');
  79 |     await expect(textarea).toBeVisible();
  80 | 
  81 |     await textarea.click();
  82 |     await page.waitForTimeout(100);
  83 | 
  84 |     const isFocused = await page.evaluate(() => {
  85 |       const el = document.querySelector('[placeholder*="Message"]');
  86 |       return el ? document.activeElement === el : false;
  87 |     });
  88 |     expect(isFocused).toBe(true);
  89 |   });
  90 | });
  91 | 
```