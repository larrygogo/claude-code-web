#!/bin/sh
# 运行时环境变量注入脚本
# 将环境变量注入到前端可访问的 JavaScript 文件中

set -e

ENV_FILE="/usr/share/nginx/html/env-config.js"

# 转义 JavaScript 字符串中的特殊字符
escape_js_string() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/'"'"'/\\'"'"'/g'
}

# 获取并转义 API URL
API_URL=$(escape_js_string "${VITE_API_URL:-http://localhost:3001}")

# 创建环境变量配置文件
cat > "$ENV_FILE" << EOF
// 运行时环境变量配置 - 由 Docker 容器启动时自动生成
// 生成时间: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
window.__ENV__ = {
  VITE_API_URL: "${API_URL}"
};
EOF

echo "Environment variables injected to $ENV_FILE"
