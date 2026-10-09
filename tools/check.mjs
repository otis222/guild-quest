// 用無頭 Chromium 實際打開打包好的作業網頁：手機 375×812 走一次「建立 OC → 進大廳 → 重新整理」，再看桌機。
// 用法：node check.mjs <網址> <截圖資料夾>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const url = process.argv[2];
const shots = process.argv[3];
mkdirSync(shots, { recursive: true });
const origin = new URL(url).origin;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const problems = [];

async function open(name, contextOpts) {
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${name}] console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) problems.push(`[${name}] 外部請求：${r.url()}`); });
  page.on('requestfailed', (r) => problems.push(`[${name}] 請求失敗：${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`[${name}] HTTP ${r.status()}：${r.url()}`); });
  return { ctx, page };
}

// 手機
const m = await open('mobile', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.page.goto(url, { waitUntil: 'load' });
await m.page.waitForSelector('form.card', { timeout: 30000 });
await m.page.waitForTimeout(1500);
await m.page.screenshot({ path: join(shots, '01-mobile-create.png') });

const overflowX = await m.page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
if (overflowX) problems.push('[mobile] 有橫向捲動');

await m.page.fill('#ocName', 'Wasabi');
await m.page.locator('label.pick').first().click();
await m.page.locator('form.card button[type=submit]').click();
await m.page.waitForSelector('form.card', { state: 'detached', timeout: 15000 });
await m.page.waitForTimeout(2500);
await m.page.screenshot({ path: join(shots, '02-mobile-lobby.png') });

const dbs = await m.page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
console.log('IndexedDB：', dbs.join(', '));
if (!dbs.includes('guild-quest-hw5')) problems.push('[mobile] 沒有 guild-quest-hw5 資料庫');
if (dbs.includes('oc-guild-quest')) problems.push('[mobile] 還在用組專案的資料庫名稱');

await m.page.reload({ waitUntil: 'load' });
await m.page.waitForTimeout(4000);
const cardAgain = await m.page.locator('form.card').count();
if (cardAgain) problems.push('[mobile] 重新整理後又跳出建立 OC 卡片（存檔沒留住）');
await m.page.screenshot({ path: join(shots, '03-mobile-reload.png') });
const webgl = await m.page.evaluate(() => {
  const c = document.querySelector('#stage canvas');
  return c ? { w: c.width, h: c.height } : null;
});
console.log('canvas：', JSON.stringify(webgl));
await m.ctx.close();

// 桌機
const d = await open('desktop', { viewport: { width: 1280, height: 800 } });
await d.page.goto(url, { waitUntil: 'load' });
await d.page.waitForSelector('form.card', { timeout: 30000 });
await d.page.waitForTimeout(1500);
await d.page.screenshot({ path: join(shots, '04-desktop-create.png') });
await d.ctx.close();

await browser.close();
console.log(problems.length ? `發現 ${problems.length} 個問題：\n${problems.join('\n')}` : '沒有發現問題');
