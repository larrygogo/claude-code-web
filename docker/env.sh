#!/bin/sh
# 运行时环境变量注入脚本
# 将环境变量注入到前端可访问的 JavaScript 文件中

ENV_FILE="/usr/share/nginx/html/env-config.js"

# 创建环境变量配置文件
cat > "$ENV_FILE" << EOF
// 运行时环境变量配置 - 由 Docker 容器启动时自动生成
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:3001}"
};
EOF

echo "Environment variables injected to $ENV_FILE"
