#!/usr/bin/env bash
# 用法: bash new-report.sh <report-slug> [output-dir]
# 示例: bash new-report.sh huayou-cobalt-analysis /Volumes/xxx/reports
# 生成: <output-dir>/<report-slug>/{index.html, assets/charts.js, _shared/{fonts,js}}
set -euo pipefail

SLUG="${1:?用法: bash new-report.sh <report-slug> [output-dir]}"
OUT="${2:-$(pwd)/reports}"
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../template" && pwd)"
TARGET="$OUT/$SLUG"

if [ -e "$TARGET" ]; then
  echo "✘ 目标已存在: $TARGET" >&2
  exit 1
fi

mkdir -p "$TARGET"
cp -R "$TEMPLATE_DIR/." "$TARGET/"
mv "$TARGET/index.html" "$TARGET/$SLUG.html"

echo "✔ 已生成: $TARGET"
echo "  主文件: $TARGET/$SLUG.html"
echo "  图表:   $TARGET/assets/charts.js"
echo "  资源:   $TARGET/_shared/{fonts,js}"
