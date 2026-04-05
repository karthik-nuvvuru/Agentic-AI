# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.ts >> Visual Regression Tests >> chat interface visual snapshot
- Location: tests/visual.spec.ts:43:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Hello world')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Hello world')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - button "New Chat" [ref=e8] [cursor=pointer]:
      - img [ref=e10]
      - text: New Chat
    - generic [ref=e13]:
      - img [ref=e14]
      - textbox "Search…" [ref=e16]
    - generic [ref=e18]:
      - paragraph [ref=e19]: Today
      - button "New conversation" [ref=e20] [cursor=pointer]:
        - generic [ref=e22]: New conversation
        - generic [ref=e23]:
          - button [ref=e24]:
            - img [ref=e25]
          - button [ref=e27]:
            - img [ref=e28]
      - button "New conversation" [ref=e30] [cursor=pointer]:
        - generic [ref=e32]: New conversation
        - generic [ref=e33]:
          - button [ref=e34]:
            - img [ref=e35]
          - button [ref=e37]:
            - img [ref=e38]
      - button "New conversation" [ref=e40] [cursor=pointer]:
        - generic [ref=e42]: New conversation
        - generic [ref=e43]:
          - button [ref=e44]:
            - img [ref=e45]
          - button [ref=e47]:
            - img [ref=e48]
      - button "New conversation" [ref=e50] [cursor=pointer]:
        - generic [ref=e52]: New conversation
        - generic [ref=e53]:
          - button [ref=e54]:
            - img [ref=e55]
          - button [ref=e57]:
            - img [ref=e58]
      - button "New conversation" [ref=e60] [cursor=pointer]:
        - generic [ref=e62]: New conversation
        - generic [ref=e63]:
          - button [ref=e64]:
            - img [ref=e65]
          - button [ref=e67]:
            - img [ref=e68]
      - button "New conversation" [ref=e70] [cursor=pointer]:
        - generic [ref=e72]: New conversation
        - generic [ref=e73]:
          - button [ref=e74]:
            - img [ref=e75]
          - button [ref=e77]:
            - img [ref=e78]
      - button "New conversation" [ref=e80] [cursor=pointer]:
        - generic [ref=e82]: New conversation
        - generic [ref=e83]:
          - button [ref=e84]:
            - img [ref=e85]
          - button [ref=e87]:
            - img [ref=e88]
      - button "New conversation" [ref=e90] [cursor=pointer]:
        - generic [ref=e92]: New conversation
        - generic [ref=e93]:
          - button [ref=e94]:
            - img [ref=e95]
          - button [ref=e97]:
            - img [ref=e98]
      - button "New conversation" [ref=e100] [cursor=pointer]:
        - generic [ref=e102]: New conversation
        - generic [ref=e103]:
          - button [ref=e104]:
            - img [ref=e105]
          - button [ref=e107]:
            - img [ref=e108]
      - button "New conversation" [ref=e110] [cursor=pointer]:
        - generic [ref=e112]: New conversation
        - generic [ref=e113]:
          - button [ref=e114]:
            - img [ref=e115]
          - button [ref=e117]:
            - img [ref=e118]
      - button "New conversation" [ref=e120] [cursor=pointer]:
        - generic [ref=e122]: New conversation
        - generic [ref=e123]:
          - button [ref=e124]:
            - img [ref=e125]
          - button [ref=e127]:
            - img [ref=e128]
      - button "New conversation" [ref=e130] [cursor=pointer]:
        - generic [ref=e132]: New conversation
        - generic [ref=e133]:
          - button [ref=e134]:
            - img [ref=e135]
          - button [ref=e137]:
            - img [ref=e138]
      - button "New conversation" [ref=e140] [cursor=pointer]:
        - generic [ref=e142]: New conversation
        - generic [ref=e143]:
          - button [ref=e144]:
            - img [ref=e145]
          - button [ref=e147]:
            - img [ref=e148]
      - button "New conversation" [ref=e150] [cursor=pointer]:
        - generic [ref=e152]: New conversation
        - generic [ref=e153]:
          - button [ref=e154]:
            - img [ref=e155]
          - button [ref=e157]:
            - img [ref=e158]
      - button "New conversation" [ref=e160] [cursor=pointer]:
        - generic [ref=e162]: New conversation
        - generic [ref=e163]:
          - button [ref=e164]:
            - img [ref=e165]
          - button [ref=e167]:
            - img [ref=e168]
      - button "New conversation" [ref=e170] [cursor=pointer]:
        - generic [ref=e172]: New conversation
        - generic [ref=e173]:
          - button [ref=e174]:
            - img [ref=e175]
          - button [ref=e177]:
            - img [ref=e178]
      - button "New conversation" [ref=e180] [cursor=pointer]:
        - generic [ref=e182]: New conversation
        - generic [ref=e183]:
          - button [ref=e184]:
            - img [ref=e185]
          - button [ref=e187]:
            - img [ref=e188]
      - button "New conversation" [ref=e190] [cursor=pointer]:
        - generic [ref=e192]: New conversation
        - generic [ref=e193]:
          - button [ref=e194]:
            - img [ref=e195]
          - button [ref=e197]:
            - img [ref=e198]
      - button "New conversation" [ref=e200] [cursor=pointer]:
        - generic [ref=e202]: New conversation
        - generic [ref=e203]:
          - button [ref=e204]:
            - img [ref=e205]
          - button [ref=e207]:
            - img [ref=e208]
      - button "New conversation" [ref=e210] [cursor=pointer]:
        - generic [ref=e212]: New conversation
        - generic [ref=e213]:
          - button [ref=e214]:
            - img [ref=e215]
          - button [ref=e217]:
            - img [ref=e218]
      - button "New conversation" [ref=e220] [cursor=pointer]:
        - generic [ref=e222]: New conversation
        - generic [ref=e223]:
          - button [ref=e224]:
            - img [ref=e225]
          - button [ref=e227]:
            - img [ref=e228]
      - button "New conversation" [ref=e230] [cursor=pointer]:
        - generic [ref=e232]: New conversation
        - generic [ref=e233]:
          - button [ref=e234]:
            - img [ref=e235]
          - button [ref=e237]:
            - img [ref=e238]
      - button "New conversation" [ref=e240] [cursor=pointer]:
        - generic [ref=e242]: New conversation
        - generic [ref=e243]:
          - button [ref=e244]:
            - img [ref=e245]
          - button [ref=e247]:
            - img [ref=e248]
      - button "New conversation" [ref=e250] [cursor=pointer]:
        - generic [ref=e252]: New conversation
        - generic [ref=e253]:
          - button [ref=e254]:
            - img [ref=e255]
          - button [ref=e257]:
            - img [ref=e258]
      - button "New conversation" [ref=e260] [cursor=pointer]:
        - generic [ref=e262]: New conversation
        - generic [ref=e263]:
          - button [ref=e264]:
            - img [ref=e265]
          - button [ref=e267]:
            - img [ref=e268]
      - button "New conversation" [ref=e270] [cursor=pointer]:
        - generic [ref=e272]: New conversation
        - generic [ref=e273]:
          - button [ref=e274]:
            - img [ref=e275]
          - button [ref=e277]:
            - img [ref=e278]
      - button "New conversation" [ref=e280] [cursor=pointer]:
        - generic [ref=e282]: New conversation
        - generic [ref=e283]:
          - button [ref=e284]:
            - img [ref=e285]
          - button [ref=e287]:
            - img [ref=e288]
      - button "New conversation" [ref=e290] [cursor=pointer]:
        - generic [ref=e292]: New conversation
        - generic [ref=e293]:
          - button [ref=e294]:
            - img [ref=e295]
          - button [ref=e297]:
            - img [ref=e298]
      - button "New conversation" [ref=e300] [cursor=pointer]:
        - generic [ref=e302]: New conversation
        - generic [ref=e303]:
          - button [ref=e304]:
            - img [ref=e305]
          - button [ref=e307]:
            - img [ref=e308]
      - button "New conversation" [ref=e310] [cursor=pointer]:
        - generic [ref=e312]: New conversation
        - generic [ref=e313]:
          - button [ref=e314]:
            - img [ref=e315]
          - button [ref=e317]:
            - img [ref=e318]
      - button "New conversation" [ref=e320] [cursor=pointer]:
        - generic [ref=e322]: New conversation
        - generic [ref=e323]:
          - button [ref=e324]:
            - img [ref=e325]
          - button [ref=e327]:
            - img [ref=e328]
      - button "New conversation" [ref=e330] [cursor=pointer]:
        - generic [ref=e332]: New conversation
        - generic [ref=e333]:
          - button [ref=e334]:
            - img [ref=e335]
          - button [ref=e337]:
            - img [ref=e338]
      - button "New conversation" [ref=e340] [cursor=pointer]:
        - generic [ref=e342]: New conversation
        - generic [ref=e343]:
          - button [ref=e344]:
            - img [ref=e345]
          - button [ref=e347]:
            - img [ref=e348]
      - button "New conversation" [ref=e350] [cursor=pointer]:
        - generic [ref=e352]: New conversation
        - generic [ref=e353]:
          - button [ref=e354]:
            - img [ref=e355]
          - button [ref=e357]:
            - img [ref=e358]
      - button "New conversation" [ref=e360] [cursor=pointer]:
        - generic [ref=e362]: New conversation
        - generic [ref=e363]:
          - button [ref=e364]:
            - img [ref=e365]
          - button [ref=e367]:
            - img [ref=e368]
      - button "New conversation" [ref=e370] [cursor=pointer]:
        - generic [ref=e372]: New conversation
        - generic [ref=e373]:
          - button [ref=e374]:
            - img [ref=e375]
          - button [ref=e377]:
            - img [ref=e378]
      - button "New conversation" [ref=e380] [cursor=pointer]:
        - generic [ref=e382]: New conversation
        - generic [ref=e383]:
          - button [ref=e384]:
            - img [ref=e385]
          - button [ref=e387]:
            - img [ref=e388]
      - button "New conversation" [ref=e390] [cursor=pointer]:
        - generic [ref=e392]: New conversation
        - generic [ref=e393]:
          - button [ref=e394]:
            - img [ref=e395]
          - button [ref=e397]:
            - img [ref=e398]
      - button "New conversation" [ref=e400] [cursor=pointer]:
        - generic [ref=e402]: New conversation
        - generic [ref=e403]:
          - button [ref=e404]:
            - img [ref=e405]
          - button [ref=e407]:
            - img [ref=e408]
      - button "New conversation" [ref=e410] [cursor=pointer]:
        - generic [ref=e412]: New conversation
        - generic [ref=e413]:
          - button [ref=e414]:
            - img [ref=e415]
          - button [ref=e417]:
            - img [ref=e418]
      - button "New conversation" [ref=e420] [cursor=pointer]:
        - generic [ref=e422]: New conversation
        - generic [ref=e423]:
          - button [ref=e424]:
            - img [ref=e425]
          - button [ref=e427]:
            - img [ref=e428]
      - button "New conversation" [ref=e430] [cursor=pointer]:
        - generic [ref=e432]: New conversation
        - generic [ref=e433]:
          - button [ref=e434]:
            - img [ref=e435]
          - button [ref=e437]:
            - img [ref=e438]
      - button "New conversation" [ref=e440] [cursor=pointer]:
        - generic [ref=e442]: New conversation
        - generic [ref=e443]:
          - button [ref=e444]:
            - img [ref=e445]
          - button [ref=e447]:
            - img [ref=e448]
      - button "New conversation" [ref=e450] [cursor=pointer]:
        - generic [ref=e452]: New conversation
        - generic [ref=e453]:
          - button [ref=e454]:
            - img [ref=e455]
          - button [ref=e457]:
            - img [ref=e458]
    - generic [ref=e461]:
      - generic [ref=e462]: T
      - generic [ref=e463]:
        - paragraph [ref=e464]: Test User
        - paragraph [ref=e465]: test@example.com
      - button "Sign out" [ref=e466] [cursor=pointer]:
        - img [ref=e467]
  - generic [ref=e470]:
    - generic [ref=e471]:
      - paragraph [ref=e473]: New Chat
      - generic [ref=e474]:
        - button "Light mode" [ref=e475] [cursor=pointer]:
          - img [ref=e476]
        - button "Upload files" [ref=e478] [cursor=pointer]:
          - img [ref=e479]
        - button "T" [ref=e481] [cursor=pointer]:
          - generic [ref=e482]: T
    - generic [ref=e485]:
      - img [ref=e487]
      - paragraph [ref=e491]: Ask me anything
      - paragraph [ref=e492]: Upload your documents and ask questions. Get intelligent, source-attributed answers powered by RAG.
      - generic [ref=e493]:
        - generic [ref=e494]:
          - img [ref=e496]
          - paragraph [ref=e498]: Upload documents
          - paragraph [ref=e499]: PDF, TXT, MD, CSV
        - generic [ref=e500]:
          - img [ref=e502]
          - paragraph [ref=e504]: Smart search
          - paragraph [ref=e505]: Vector + keyword RAG
        - generic [ref=e506]:
          - img [ref=e508]
          - paragraph [ref=e510]: Follow-ups
          - paragraph [ref=e511]: Stay in context
      - paragraph [ref=e512]: Try asking
      - generic [ref=e513]:
        - generic [ref=e514] [cursor=pointer]:
          - generic [ref=e515]: 📄
          - paragraph [ref=e516]: Summarize the key points from the uploaded document
        - generic [ref=e517] [cursor=pointer]:
          - generic [ref=e518]: 🔍
          - paragraph [ref=e519]: What are the main topics covered in my files?
        - generic [ref=e520] [cursor=pointer]:
          - generic [ref=e521]: ⚖️
          - paragraph [ref=e522]: Compare and contrast the findings
        - generic [ref=e523] [cursor=pointer]:
          - generic [ref=e524]: 💡
          - paragraph [ref=e525]: What conclusions can be drawn?
    - generic [ref=e528]:
      - generic [ref=e530]:
        - button "Attach files" [ref=e531] [cursor=pointer]:
          - img [ref=e532]
        - textbox "Message Agentic AI\\u2026" [active] [ref=e536]
        - button "Send message" [disabled]:
          - img
      - paragraph [ref=e537]: Press Enter to send, Shift+Enter for new line
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | async function apiLoginAndGo(page: any) {
  4  |   let data: any;
  5  |   let res = await page.request.post('http://localhost:8000/v1/auth/login', {
  6  |     headers: { 'Content-Type': 'application/json' },
  7  |     data: { email: 'test@example.com', password: 'testpass123' },
  8  |   });
  9  |   if (!res.ok()) {
  10 |     // Auto-register if user doesn't exist or conflict
  11 |     await page.request.post('http://localhost:8000/v1/auth/register', {
  12 |       headers: { 'Content-Type': 'application/json' },
  13 |       data: { email: 'test@example.com', password: 'testpass123', name: 'Test User' },
  14 |     }).catch(() => {});
  15 |     res = await page.request.post('http://localhost:8000/v1/auth/login', {
  16 |       headers: { 'Content-Type': 'application/json' },
  17 |       data: { email: 'test@example.com', password: 'testpass123' },
  18 |     });
  19 |   }
  20 |   data = await res.json();
  21 |   const token = data.access_token;
  22 |   await page.goto('/');
  23 |   await page.evaluate((token) => localStorage.setItem('auth_access_token', token), token);
  24 |   await page.goto('/');
  25 |   await page.waitForTimeout(500);
  26 | }
  27 | 
  28 | test.describe('Visual Regression Tests', () => {
  29 |   test.describe.configure({ mode: 'serial' });
  30 | 
  31 |   test.beforeEach(async ({ page }) => {
  32 |     await apiLoginAndGo(page);
  33 |   });
  34 | 
  35 |   test('welcome screen visual snapshot', async ({ page }) => {
  36 |     await expect(page.locator('text=Ask me anything')).toBeVisible();
  37 |     await expect(page.locator('text=Upload your documents')).toBeVisible({ timeout: 5000 }).catch(() => {
  38 |       // Welcome screen may show "What can I help with?" instead
  39 |     });
  40 |     await page.screenshot({ path: 'tests/screenshots/visual-welcome.png' });
  41 |   });
  42 | 
  43 |   test('chat interface visual snapshot', async ({ page }) => {
  44 |     const input = page.locator('[placeholder*="Message"]');
  45 |     await input.fill('Hello world');
  46 |     await input.press('Enter');
  47 |     await page.waitForTimeout(2000);
  48 | 
> 49 |     await expect(page.locator('text=Hello world')).toBeVisible();
     |                                                    ^ Error: expect(locator).toBeVisible() failed
  50 |     await page.screenshot({ path: 'tests/screenshots/visual-message.png' });
  51 |   });
  52 | 
  53 |   test('input area visual snapshot', async ({ page }) => {
  54 |     await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
  55 |     await expect(page.locator('[title="Send message"]')).toBeVisible();
  56 |     await expect(page.locator('[title="Attach files"]')).toBeVisible();
  57 |   });
  58 | 
  59 |   test('mobile layout visual snapshot', async ({ page }) => {
  60 |     await page.setViewportSize({ width: 375, height: 667 });
  61 |     await page.reload();
  62 |     await page.waitForTimeout(500);
  63 | 
  64 |     await expect(page.locator('text=Agentic AI')).toBeVisible();
  65 |   });
  66 | 
  67 |   test('tablet layout visual snapshot', async ({ page }) => {
  68 |     await page.setViewportSize({ width: 768, height: 1024 });
  69 |     await page.reload();
  70 |     await page.waitForTimeout(1000);
  71 | 
  72 |     await expect(page.locator('button:has-text("New Chat")').first()).toBeVisible();
  73 |     await expect(page.locator('[placeholder*="Message"]')).toBeVisible();
  74 |   });
  75 | 
  76 |   test('hover states visual snapshot', async ({ page }) => {
  77 |     const input = page.locator('[placeholder*="Message"]');
  78 |     await input.fill('Hover test');
  79 |     await input.press('Enter');
  80 |     await page.waitForTimeout(2000);
  81 | 
  82 |     await expect(page.locator('[title="Send message"]')).toBeVisible();
  83 |   });
  84 | });
  85 | 
```