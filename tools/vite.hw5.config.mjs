// TAICA 第五週作業用的打包設定。
// 組專案自己的 vite.config.ts 完全不動；這份只在作業打包時複製到專案根目錄使用。
//
// 跟組專案設定的差別：
// 1. 所有程式打成一個 JS（PixiJS 原本會拆出兩個動態載入的檔案），之後才能整份塞進 index.html。
// 2. 資料庫改名：作業網址和組專案網址都在 otis222.github.io 底下，同一個網域的 IndexedDB 是共用的，
//    不改名的話兩邊的存檔會互相讀到。
import { defineConfig } from 'vite';

const DB_FROM = "dbName = 'oc-guild-quest'";
const DB_TO = "dbName = 'guild-quest-hw5'";

function hw5Patches() {
  let patched = false;
  return {
    name: 'hw5-patches',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/core/storage.ts')) return null;
      if (!code.includes(DB_FROM)) {
        this.error('storage.ts 裡找不到預設的資料庫名稱，作業打包流程要跟著更新');
      }
      patched = true;
      return code.replace(DB_FROM, DB_TO);
    },
    buildEnd(err) {
      if (!err && !patched) this.error('沒有改到資料庫名稱（storage.ts 沒被打包進來？）');
    },
  };
}

export default defineConfig({
  base: './',
  optimizeDeps: { entries: ['index.html'] },
  plugins: [hw5Patches()],
  build: {
    outDir: 'dist-hw5',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
