// 用無頭 Chromium 把作業網頁從頭玩到尾：冒險者登記 → 接一張色彩學委託 → 5 個任務 → 交件 → 重新整理。
// 每一步截圖，最後檢查存檔、錯誤和對外的網路請求。
// 用法：node check-loop.mjs <網址> <截圖資料夾> <交件用的照片>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [url, shots, photo] = process.argv.slice(2);
if (!url || !shots || !photo) {
  console.error('用法：node check-loop.mjs <網址> <截圖資料夾> <交件用的照片>');
  process.exit(1);
}
mkdirSync(shots, { recursive: true });
const origin = new URL(url).origin;
const problems = [];
const log = (s) => console.log(`・${s}`);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function open(name, contextOpts) {
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${name}] console.${m.type()}: ${m.text()}`);
    if (m.text().includes('降畫質')) log(`[${name}] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) problems.push(`[${name}] 外部請求：${u}`);
  });
  page.on('requestfailed', (r) => problems.push(`[${name}] 請求失敗：${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`[${name}] HTTP ${r.status()}：${r.url()}`); });
  return { ctx, page };
}

const shot = async (page, file) => { await page.screenshot({ path: join(shots, file) }); log(`截圖 ${file}`); };

/** 讀作業版的存檔（idb-keyval：資料庫 guild-quest-hw5、store kv、key state） */
const readState = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('guild-quest-hw5');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const tx = req.result.transaction('kv', 'readonly');
    const get = tx.objectStore('kv').get('state');
    get.onsuccess = () => resolve(get.result ?? null);
    get.onerror = () => reject(get.error);
  };
}));

// ── 手機 375×812 ─────────────────────────────────────────
const { ctx, page } = await open('mobile', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('form.card', { timeout: 30000 });
await page.waitForTimeout(1500);
await shot(page, '01-冒險者登記.png');
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push('[mobile] 冒險者登記有橫向捲動');

await page.fill('#ocName', '小鈴');
await page.locator('form.card label.pick').first().click();
await page.getByRole('button', { name: '加入公會' }).click();
await page.waitForSelector('form.card', { state: 'detached', timeout: 15000 });
await page.waitForTimeout(3000);
await shot(page, '02-公會大廳.png');

await page.click('#btnBoard');
await page.getByRole('button', { name: '接新委託' }).click();
await page.locator('form.commission-form label', { hasText: '色彩學' }).click();
await page.fill('#cTitle', '色相環');
await page.waitForTimeout(400);
await shot(page, '03-填委託單.png');
await page.getByRole('button', { name: '接下委託' }).click();
await page.waitForSelector('button.c-start', { timeout: 10000 });
await page.waitForTimeout(500);
await shot(page, '04-委託板.png');

for (let i = 1; i <= 5; i += 1) {
  if (i > 1) {
    await page.click('#btnBoard');
    await page.waitForSelector('button.c-start', { timeout: 10000 });
  }
  await page.locator('button.c-start').first().click();
  await page.waitForSelector('.timer-layer', { timeout: 10000 });
  if (i === 1) {
    await page.waitForTimeout(2500);
    await shot(page, '05-任務計時.png');
  } else {
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: '提早完成' }).click();
  await page.waitForSelector('.timer-layer', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('.toast', { timeout: 10000 });
  if (i === 1) {
    await page.waitForTimeout(900);
    await shot(page, '06-完成任務小提示.png');
    await page.locator('.toast .toast-open').click();
    await page.waitForSelector('.oc-sec', { timeout: 10000 });
    await page.waitForTimeout(900);
    await shot(page, '07-OC設定卡亮一片.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  log(`任務 ${i}/5 完成`);
}

// 交件
await page.click('#btnBoard');
await page.locator('button.c-start.is-submit').click();
await page.locator('input[type=file]:not([capture])').setInputFiles(photo);
await page.waitForSelector('.submit-photo img', { timeout: 15000 });
await page.waitForTimeout(800);
await shot(page, '08-交件預覽.png');
const swatches = await page.locator('.swatches .swatch').count();
log(`抽出 ${swatches} 色`);
if (!swatches) problems.push('[mobile] 交件預覽沒有抽出配色');
await page.locator('.card .form-actions button.primary').click();
await page.waitForSelector('.submit-photo', { state: 'detached', timeout: 15000 });
await page.waitForTimeout(1200);
await shot(page, '09-交件後大廳.png');
await page.waitForTimeout(6500); // 等小提示收起來，展台和等級牌看得清楚
await shot(page, '10-展品與公會等級.png');

await page.click('#btnCard');
await page.waitForSelector('.oc-sec', { timeout: 10000 });
await page.waitForTimeout(900);
await shot(page, '11-OC設定卡交件後.png');
await page.keyboard.press('Escape');

const s1 = await readState(page);
const c = s1?.commissions?.[0];
log(`存檔：OC「${s1?.oc?.name}」、公會等級 ${s1?.guildLevel}、委託 ${s1?.commissions?.length} 張、交件 ${c?.submittedAt ? '有' : '沒有'}、配色 ${s1?.oc?.palette?.length ?? 0} 色、展品 ${s1?.exhibits?.length ?? 0} 張`);
if (s1?.guildLevel !== 2) problems.push('[mobile] 交件後公會等級不是 2');
if (!c?.submittedAt) problems.push('[mobile] 委託沒有記到交件');
if (c && c.levels.filter((l) => l.status === 'done').length !== c.levels.length) problems.push('[mobile] 有任務沒打勾');

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4000);
if (await page.locator('form.card').count()) problems.push('[mobile] 重新整理後又跳出冒險者登記');
const s2 = await readState(page);
if (JSON.stringify(s2) !== JSON.stringify(s1)) problems.push('[mobile] 重新整理後存檔不一樣');
await shot(page, '12-重新整理後.png');

// 研究模式（一般網址看不到入口）
const hasResearchBtn = await page.getByRole('button', { name: '研究模式' }).count();
if (hasResearchBtn) problems.push('[mobile] 一般網址看得到研究模式');
await page.goto(`${url}?research=1`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: '研究模式' }).click();
await page.waitForTimeout(1200);
await shot(page, '13-研究模式.png');
const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
log(`IndexedDB：${dbs.join(', ')}`);
if (dbs.includes('oc-guild-quest')) problems.push('[mobile] 用到組專案的資料庫名稱');
await ctx.close();

// ── 桌機 1280×800 ────────────────────────────────────────
const d = await open('desktop', { viewport: { width: 1280, height: 800 } });
await d.page.goto(url, { waitUntil: 'load' });
await d.page.waitForSelector('form.card', { timeout: 30000 });
await d.page.waitForTimeout(1500);
await shot(d.page, '21-桌機冒險者登記.png');
await d.page.fill('#ocName', '小鈴');
await d.page.locator('form.card label.pick').nth(1).click();
await d.page.getByRole('button', { name: '加入公會' }).click();
await d.page.waitForSelector('form.card', { state: 'detached', timeout: 15000 });
await d.page.waitForTimeout(3000);
await shot(d.page, '22-桌機公會大廳.png');
await d.page.click('#btnBoard');
await d.page.getByRole('button', { name: '接新委託' }).click();
await d.page.locator('form.commission-form label', { hasText: '平面構成' }).click();
await d.page.fill('#cTitle', '點線面構成');
await d.page.waitForTimeout(400);
await shot(d.page, '23-桌機填委託單.png');
await d.ctx.close();

await browser.close();
console.log(problems.length ? `\n發現 ${problems.length} 個問題：\n${problems.join('\n')}` : '\n沒有發現問題');
