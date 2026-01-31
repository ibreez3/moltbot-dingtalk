# MoltBot DingTalk Channel

一个 MoltBot 的 Channel 实现，通过钉钉企业应用机器人连接到 OpenClaw Gateway，支持 AI Card 流式响应和会话管理。

## 功能特性

- **AI Card 流式响应** - 打字机效果，实时显示 AI 回复
- **会话持久化** - 同一用户的多轮对话共享上下文
- **超时自动新会话** - 默认 30 分钟无活动自动开启新对话
- **手动新会话** - 发送 `/new` 或 `新会话` 清空对话历史
- **图片自动上传** - 本地图片路径自动上传到钉钉
- **策略控制** - 支持单独控制群聊/单聊的消息处理
- **自动重连** - 连接断开时自动尝试重连

## 架构设计

```
钉钉用户/群 <--WebSocket(Stream)--> MoltBotDingTalkBridge <--HTTP SSE--> OpenClaw Gateway
                                            ↓
                                     AI Card 流式输出
```

**消息流程：**
1. 用户在钉钉发送消息 → 机器人通过 WebSocket Stream 接收
2. 检查会话状态（超时/手动新建）
3. 构建对话历史并发送到 OpenClaw Gateway
4. Gateway 流式返回 AI 响应
5. 通过 AI Card 实时流式输出（打字机效果）
6. 更新会话历史

## 项目结构

```
moltbot-dingtalk/
├── src/
│   ├── types/                          # TypeScript 类型定义
│   │   ├── dingtalk.ts                # 钉钉消息类型
│   │   ├── session.ts                 # 会话管理类型
│   │   ├── openclaw.ts                # OpenClaw Gateway 类型
│   │   ├── config.ts                  # 配置类型
│   │   └── ai-card.ts                 # AI Card 类型
│   ├── services/                       # 核心服务
│   │   ├── dingtalk.stream.service.ts # 钉钉 Stream WebSocket 服务
│   │   ├── session.manager.ts         # 会话管理器
│   │   ├── openclaw.gateway.ts        # OpenClaw Gateway 客户端
│   │   ├── ai-card.service.ts         # AI Card 服务
│   │   └── media.service.ts           # 图片上传服务
│   ├── utils/
│   │   └── logger.ts                  # 日志工具
│   └── index.ts                        # 应用入口
├── .env.example                        # 环境变量示例
├── tsconfig.json                       # TypeScript 配置
└── package.json
```

## 快速开始

### 方式一：作为 OpenClaw 插件安装（推荐）

```bash
# 在 OpenClaw 目录下安装
cd /path/to/openclaw
openclaw plugins install /path/to/moltbot-dingtalk

# 或者从 git 仓库安装
openclaw plugins install https://github.com/your-username/moltbot-dingtalk.git
```

然后在 `openclaw.json` 中配置：

```json
{
  "plugins": {
    "moltbot-dingtalk": {
      "enabled": true,
      "config": {
        "dingtalk": {
          "clientId": "your_app_key",
          "clientSecret": "your_app_secret"
        }
      }
    }
  }
}
```

详细安装说明请查看 [INSTALL.md](INSTALL.md)。

### 方式二：独立运行

#### 1. 创建钉钉企业应用机器人

1. 登录 [钉钉开发者后台](https://open-dev.dingtalk.com/)
2. 创建企业内部应用
3. 在应用中添加机器人能力
4. 获取 `AppKey` 和 `AppSecret`
5. 发布应用并添加到需要使用的群聊/单聊

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# DingTalk App Configuration
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret

# OpenClaw Gateway Configuration
GATEWAY_URL=http://127.0.0.1:18789
GATEWAY_TOKEN=               # Optional
GATEWAY_PASSWORD=            # Optional

# Session Management
SESSION_TIMEOUT=1800000      # 30 minutes (in milliseconds)

# Message Policies
DM_POLICY=open               # "open" or "closed"
GROUP_POLICY=open            # "open" or "closed"

# Media Upload
ENABLE_MEDIA_UPLOAD=true

# System Prompt (optional)
# SYSTEM_PROMPT="You are a helpful AI assistant."

# Debug
DEBUG=false
```

#### 4. 启动服务

开发模式（热重载）：
```bash
npm run dev
```

生产模式：
```bash
npm run build
npm start
```

## 功能说明

### AI Card 流式响应

使用钉钉 AI Card 实现打字机效果：
- 创建 Card 实例并投递到对话
- 流式更新 Card 内容（每 300ms）
- 完成后更新状态为 FINISHED

**Card 模板 ID**: `382e4302-551d-4880-bf29-a30acfab2e71.schema`

### 会话管理

**Session Key 格式**:
- 首次消息: `dingtalk:{senderId}`
- 后续消息: `dingtalk:{senderId}:{timestamp}`

**超时机制**:
- 默认 30 分钟无活动自动创建新会话
- 可通过 `SESSION_TIMEOUT` 环境变量配置

**手动新会话**:
支持的命令:
- `/new`
- `/reset`
- `/clear`
- `新会话`
- `重新开始`
- `清空对话`

### 图片自动上传

**系统提示注入**:
```
## 钉钉图片显示规则
显示图片时，直接使用本地文件路径，系统会自动上传处理。

### 正确方式
![描述](file:///path/to/image.jpg)
![描述](/tmp/screenshot.png)

### 禁止
- 不要自己执行 curl 上传
- 不要猜测或构造 URL
```

**自动上传**:
- 检测 Markdown 图片: `![alt](file:///path)`
- 检测裸路径: `/tmp/xxx.png`
- 上传到钉钉并替换为 `media_id`

## 开发命令

```bash
# 开发模式运行
npm run dev

# 构建项目
npm run build

# 生产模式运行
npm start

# 代码检查
npm run lint

# 自动修复代码
npm run lint:fix

# 格式化代码
npm run format

# 类型检查
npm run type-check
```

## API 协议

### OpenClaw Gateway API

**端点**: `POST /v1/chat/completions`

**请求格式**:
```json
{
  "model": "default",
  "messages": [
    { "role": "system", "content": "系统提示" },
    { "role": "user", "content": "用户消息" }
  ],
  "stream": true,
  "user": "dingtalk:senderId:timestamp"
}
```

**响应格式** (SSE):
```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

### DingTalk API

**使用的 API**:
- `/v1.0/oauth2/accessToken` - 获取访问令牌
- `/v1.0/card/instances` - 创建 AI Card
- `/v1.0/card/instances/deliver` - 投递 Card 到对话
- `/v1.0/card/streaming` - 流式更新 Card
- `/media/upload` - 上传图片

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DINGTALK_APP_KEY` | 钉钉应用 AppKey | 必填 |
| `DINGTALK_APP_SECRET` | 钉钉应用 AppSecret | 必填 |
| `GATEWAY_URL` | OpenClaw Gateway 地址 | `http://127.0.0.1:18789` |
| `GATEWAY_TOKEN` | Gateway 认证令牌 | 可选 |
| `GATEWAY_PASSWORD` | Gateway 密码 | 可选 |
| `SESSION_TIMEOUT` | 会话超时时间（毫秒） | `1800000` (30分钟) |
| `DM_POLICY` | 单聊策略 | `open` |
| `GROUP_POLICY` | 群聊策略 | `open` |
| `ENABLE_MEDIA_UPLOAD` | 启用图片上传 | `true` |
| `SYSTEM_PROMPT` | 自定义系统提示 | 可选 |
| `DEBUG` | 调试模式 | `false` |

## 故障排查

### AI Card 无法显示

1. 确认机器人有发送消息权限
2. 检查 `accessToken` 是否有效
3. 查看 Card 创建 API 返回的错误信息

### 会话未持久化

1. 确认 `user` 字段正确传递给 Gateway
2. 检查 Gateway 是否支持会话管理
3. 查看日志中的 `sessionKey` 是否一致

### 图片上传失败

1. 检查文件路径是否存在
2. 确认 `ENABLE_MEDIA_UPLOAD=true`
3. 检查 `accessToken` 有上传权限

## 安全建议

1. **保护密钥** - 不要将 `.env` 文件提交到版本控制
2. **使用 HTTPS** - 生产环境建议使用 WSS (WebSocket Secure)
3. **访问控制** - 在钉钉开发者后台配置应用权限和可见范围
4. **日志管理** - 生产环境关闭 `DEBUG` 模式

## 参考

本项目参考并复刻了 [dingtalk-moltbot-connector](https://github.com/DingTalk-Real-AI/dingtalk-moltbot-connector) 的功能。

## License

ISC
