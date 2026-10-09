// 把 Vite 打包出來的 JS、CSS 塞回 index.html，變成單一檔案。
// 用法：node inline.mjs <dist 資料夾>
// 圖片（sprites/）維持獨立檔案，跟老師投影片 p.76「index.html＋assets 資料夾」的結構一樣。
import { readFileSync, writeFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2];
if (!dist) {
  console.error('用法：node inline.mjs <dist 資料夾>');
  process.exit(1);
}

const htmlPath = join(dist, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
const used = [];

const scriptTag = /<script\b[^>]*\bsrc="\.\/assets\/([^"]+\.js)"[^>]*><\/script>/g;
const cssTag = /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="\.\/assets\/([^"]+\.css)"[^>]*>/g;

html = html.replace(cssTag, (_, file) => {
  used.push(file);
  const css = readFileSync(join(dist, 'assets', file), 'utf8');
  if (/<\/style/i.test(css)) throw new Error(`${file} 裡有 </style>，不能直接內嵌`);
  return `<style>\n${css}\n</style>`;
});

html = html.replace(scriptTag, (_, file) => {
  used.push(file);
  let js = readFileSync(join(dist, 'assets', file), 'utf8');
  // 內嵌的 <script> 遇到 "</script" 會提早結束；改成 "<\/script" 在 JS 裡意思不變
  js = js.replace(/<\/script/gi, '<\\/script');
  if (js.includes('<!--')) throw new Error(`${file} 裡有 "<!--"，內嵌前要另外處理`);
  // 用函式回傳，避免 JS 裡的 "$&"、"$1" 被 String.replace 當成替換符號
  return `<script type="module">\n${js}\n</script>`;
});

if (!used.some((f) => f.endsWith('.js'))) throw new Error('index.html 裡找不到要內嵌的 JS');

const leftovers = html.match(/<(script|link)\b[^>]*(src|href)="\.\/assets\/[^"]+"/g);
if (leftovers) throw new Error(`還有沒內嵌的檔案：${leftovers.join(', ')}`);

writeFileSync(htmlPath, html);

// 已經塞進 index.html 的檔案刪掉；assets/ 空了就整個刪掉
for (const file of used) rmSync(join(dist, 'assets', file));
const rest = readdirSync(join(dist, 'assets'));
if (rest.length === 0) rmdirSync(join(dist, 'assets'));
else console.warn('assets/ 還有其他檔案（沒有內嵌）：', rest.join(', '));

console.log(`內嵌完成：${used.join(', ')}`);
console.log(`index.html：${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
