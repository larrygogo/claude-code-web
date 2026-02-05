# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build shared package
RUN pnpm --filter @claude-web/shared build

# Generate Prisma client
RUN pnpm --filter @claude-web/server db:generate

# Build server
RUN pnpm --filter @claude-web/server build

# Build client
RUN pnpm --filter @claude-web/client build

# Server production stage
FROM node:20-alpine AS server

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/server/node_modules/.prisma ./packages/server/node_modules/.prisma

WORKDIR /app/packages/server

EXPOSE 3001

CMD ["node", "dist/index.js"]

# Client production stage - 使用 nginx 服务 Vite 静态文件
FROM nginx:1.25-alpine AS client

# 复制 nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

# 复制环境变量注入脚本
COPY docker/env.sh /docker-entrypoint.d/40-env.sh
RUN chmod +x /docker-entrypoint.d/40-env.sh

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
