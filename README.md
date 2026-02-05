# Claude Code Web

基于 Claude Agent SDK 的多用户 Web 服务，提供与 Claude Code CLI 相同的能力，支持云端部署。

## 特性

- **多用户支持**：用户注册/登录、JWT 认证、数据隔离
- **流式对话**：SSE 实时流式输出，支持打字机效果
- **工具调用展示**：展示 Read/Write/Edit/Bash 等工具调用过程
- **会话管理**：创建、恢复、分支、导入会话
- **项目管理**：注册项目、加载 CLAUDE.md
- **计划模式**：支持 Plan 模式查看和执行
- **移动端优先**：响应式设计，移动端手势支持
- **CLI 兼容**：兼容 ~/.claude 格式，支持导入 CLI 会话

## 技术栈

- **后端**：Node.js + Express + Prisma + SQLite
- **前端**：Next.js 14 + React 18 + Tailwind CSS + Zustand
- **SDK**：@anthropic-ai/claude-code
- **构建**：pnpm + Turborepo
- **部署**：Docker + Docker Compose

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd claude-code-web

# 安装依赖
pnpm install

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，填入必要的配置
# - ANTHROPIC_API_KEY: Anthropic API 密钥
# - JWT_SECRET: JWT 密钥 (生产环境请使用强随机字符串)
```

### 初始化数据库

```bash
# 生成 Prisma 客户端
pnpm db:generate

# 推送数据库 schema
pnpm db:push
```

### 开发运行

```bash
# 启动开发服务器 (前后端同时运行)
pnpm dev
```

- 前端：http://localhost:3000
- 后端：http://localhost:3001

### 构建生产版本

```bash
pnpm build
```

## Docker 部署

### 使用 Docker Compose

```bash
cd docker

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，填入必要的配置

# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

服务启动后：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001

## 项目结构

```
claude-code-web/
├── packages/
│   ├── shared/          # 共享类型定义
│   ├── server/          # Express 后端服务
│   │   ├── src/
│   │   │   ├── api/     # API 路由
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   └── storage/
│   │   └── prisma/      # 数据库 Schema
│   └── client/          # Next.js 前端应用
│       └── src/
│           ├── app/     # 页面
│           ├── components/
│           ├── hooks/
│           ├── lib/
│           └── stores/
├── docker/              # Docker 配置
└── package.json
```

## API 文档

### 认证 API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 获取当前用户 |

### 聊天 API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/chat/stream` | SSE 流式聊天 |
| POST | `/api/chat/abort/:sessionId` | 中断生成 |

### 会话 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/sessions` | 获取会话列表 |
| GET | `/api/sessions/:id` | 获取会话详情 |
| POST | `/api/sessions` | 创建新会话 |
| DELETE | `/api/sessions/:id` | 删除会话 |
| POST | `/api/sessions/:id/fork` | 分支会话 |
| POST | `/api/sessions/import` | 导入 CLI 会话 |

### 项目 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/projects` | 获取项目列表 |
| POST | `/api/projects` | 注册项目 |
| GET | `/api/projects/:id/context` | 获取项目上下文 |

### 计划 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/plans` | 获取计划列表 |
| POST | `/api/plans` | 创建计划 |
| PATCH | `/api/plans/:id` | 更新计划 |
| POST | `/api/plans/:id/execute` | 执行计划 |

## 许可证

MIT
