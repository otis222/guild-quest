#!/usr/bin/env bash
# 作業打包：組專案原始碼（某個 commit 的快照）→ 單一 index.html＋sprites/
# 用法：build-hw5.sh <專案快照資料夾> <輸出資料夾>
set -euo pipefail

SNAP="$(cd "$1" && pwd)"
OUT="$2"
TOOLS="$(cd "$(dirname "$0")" && pwd)"

cd "$SNAP"
cp "$TOOLS/vite.hw5.config.mjs" ./vite.hw5.config.mjs

echo "== 型別檢查與單元測試（跟組專案的 npm run build／npm test 一樣要過）"
npx tsc
npx vitest run --reporter=dot

echo "== Vite 打包（作業設定）"
npx vite build --config vite.hw5.config.mjs

echo "== 把 JS、CSS 塞進 index.html"
node "$TOOLS/inline.mjs" dist-hw5

echo "== 檢查"
if grep -q 'src="./assets/' dist-hw5/index.html; then echo "還有外部 JS"; exit 1; fi
if grep -q 'cdnjs' dist-hw5/index.html; then echo "有 cdnjs 網址"; exit 1; fi
if ! grep -q "guild-quest-hw5" dist-hw5/index.html; then echo "資料庫沒有改名"; exit 1; fi
test -f dist-hw5/sprites/manifest.json

rm -rf "$OUT"
mkdir -p "$OUT"
cp -r dist-hw5/. "$OUT/"
echo "== 輸出：$OUT"
find "$OUT" -type f -printf '%8s  %P\n' | sort -k2
