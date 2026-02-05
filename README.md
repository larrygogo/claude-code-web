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
- **管理后台**：模型配置、用户管理、系统设置

## 技术栈

- **后端**：Node.js + Express + Prisma + SQLite
- **前端**：Vite + React 18 + React Router 6 + Tailwind CSS + Zustand
- **SDK**：@anthropic-ai/sdk
- **构建**：pnpm + Turborepo
- **部署**：Docker + Docker Compose

## 本地部署

### 环境要求

- Node.js >= 18
- pnpm >= 8 (使用 `npm install -g pnpm` 安装)

### 部署步骤

#### 1. 安装依赖

```bash
pnpm install
```

#### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并编辑：

```bash
cp .env.example .env
```

**必须配置的变量：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | `sk-ant-xxx` |
| `JWT_SECRET` | JWT 签名密钥（生产环境用强随机字符串） | `openssl rand -base64 32` 生成 |
| `JWT_REFRESH_SECRET` | JWT 刷新令牌密钥 | 同上 |

**可选配置：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端端口 |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | API 端点（可配置代理） |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | 默认模型 |
| `CLIENT_URL` | `http://localhost:3000` | 前端地址 |

#### 3. 初始化数据库

```bash
# 生成 Prisma 客户端
pnpm db:generate

# 推送数据库 Schema（创建表）
pnpm db:push

# 运行种子脚本（创建管理员账号和默认模型配置）
pnpm --filter @claude-web/server db:seed
```

种子脚本会创建：
- 管理员账号：`admin@example.com` / `admin123`
- 从环境变量迁移的模型配置（如果设置了 `ANTHROPIC_API_KEY`）

#### 4. 启动开发服务器

```bash
pnpm dev
```

#### 5. 访问应用

- **前端**：http://localhost:3000
- **后端 API**：http://localhost:3001
- **管理后台**：http://localhost:3000/admin （需要用管理员账号登录）

### 默认账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | `admin@example.com` | `admin123` |

建议首次登录后在管理后台修改默认密码。

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（前后端同时） |
| `pnpm build` | 构建生产版本 |
| `pnpm db:push` | 推送数据库变更 |
| `pnpm --filter @claude-web/server db:seed` | 运行种子脚本 |

### 注意事项

1. **首次运行**：必须先运行 `pnpm db:push` 创建数据库表
2. **API Key**：可以在管理后台动态配置模型，无需重启服务
3. **数据目录**：SQLite 数据库文件在 `packages/server/prisma/data/db/`

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
│   └── client/          # Vite + React 前端应用
│       └── src/
│           ├── pages/       # 页面组件
│           ├── components/  # UI 组件
│           ├── hooks/       # 自定义 Hooks
│           ├── lib/         # 工具函数
│           └── stores/      # Zustand 状态管理
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

### 管理 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/admin/models` | 获取模型配置列表 |
| POST | `/api/admin/models` | 创建模型配置 |
| PUT | `/api/admin/models/:id` | 更新模型配置 |
| DELETE | `/api/admin/models/:id` | 删除模型配置 |
| GET | `/api/admin/users` | 获取用户列表 |
| PUT | `/api/admin/users/:id` | 更新用户信息 |

## 许可证

MIT
