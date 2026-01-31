# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**moltbot-dingtalk** is a bridge that connects DingTalk's enterprise app bot (using Stream mode) to OpenClaw Gateway. It supports AI Card streaming responses with typewriter effect, session persistence, automatic image upload, and session management.

### Architecture

```
DingTalk User/Group <--WebSocket(Stream)--> MoltBotDingTalkBridge <--HTTP SSE--> OpenClaw Gateway
                                            ↓
                                     AI Card Streaming Output
```

**Message Flow:**
1. User sends message in DingTalk → Bot receives via WebSocket Stream
2. Check session state (timeout/manual new)
3. Build conversation history and send to OpenClaw Gateway
4. Gateway streams back AI response (SSE)
5. Stream to DingTalk AI Card in real-time (typewriter effect)
6. Update conversation history

### Key Features

- **AI Card Streaming**: Creates DingTalk AI Card and streams content with 300ms throttling for typewriter effect
- **Session Persistence**: Uses `user` field (format: `dingtalk:{senderId}:{timestamp}`) for context persistence across messages
- **Auto New Session**: 30-minute timeout (configurable) automatically creates new session
- **Manual New Session**: Commands like `/new`, `新会话`, `/reset`, `/clear`, `重新开始`, `清空对话`
- **Image Upload**: Auto-detects local image paths (`file://`, `/tmp/`, etc.) and uploads to DingTalk
- **Policy Control**: Separate policies for DM (`DM_POLICY`) and group messages (`GROUP_POLICY`)

## Key Components

### Services

| Service | File | Purpose |
|---------|------|---------|
| `DingTalkStreamService` | `src/services/dingtalk.stream.service.ts` | Manages WebSocket connection to DingTalk Stream API, receives messages, sends responses |
| `SessionManager` | `src/services/session.manager.ts` | Manages user sessions with timeout and manual reset |
| `OpenClawGateway` | `src/services/openclaw.gateway.ts` | HTTP SSE client for streaming chat completions |
| `AICardService` | `src/services/ai-card.service.ts` | Creates and streams content to DingTalk AI Cards |
| `MediaService` | `src/services/media.service.ts` | Uploads local images to DingTalk |

### Types

| Type | File | Purpose |
|------|------|---------|
| `DingTalkStreamMessage` | `src/types/dingtalk.ts` | Message received from DingTalk Stream |
| `GatewayMessage` | `src/types/openclaw.ts` | Message format for OpenClaw Gateway |
| `UserSession` | `src/types/session.ts` | Session data structure |
| `AICardInstance` | `src/types/ai-card.ts` | AI Card instance data |

## Development Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production mode (requires build first)
npm start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
```

## Environment Configuration

Required environment variables (see `.env.example`):
- `DINGTALK_APP_KEY`: DingTalk enterprise app key (from developer console)
- `DINGTALK_APP_SECRET`: DingTalk enterprise app secret
- `GATEWAY_URL`: OpenClaw Gateway URL (default: `http://127.0.0.1:18789`)
- `GATEWAY_TOKEN`: Optional Bearer token for Gateway authentication
- `GATEWAY_PASSWORD`: Alternative password for Gateway authentication
- `SESSION_TIMEOUT`: Session timeout in milliseconds (default: 1800000 = 30 minutes)
- `DM_POLICY`: Direct message policy - `open` or `closed` (default: `open`)
- `GROUP_POLICY`: Group message policy - `open` or `closed` (default: `open`)
- `ENABLE_MEDIA_UPLOAD`: Enable automatic image upload (default: `true`)
- `SYSTEM_PROMPT`: Optional custom system prompt
- `DEBUG`: Enable debug logging (default: `false`)

## Code Conventions

- **TypeScript**: Strict mode enabled, use type annotations
- **Module system**: ES modules with `.js` extensions in imports (due to Node16 module resolution)
- **Error handling**: Async functions use try-catch, errors logged but don't crash the service
- **Logging**: Use `logger` utility from `src/utils/logger.ts` with appropriate log levels
- **Service initialization**: AI Card and Media services are initialized when access token becomes available via callback

## Important Implementation Details

### Session Management

**Session Key Format:**
- First message: `dingtalk:{senderId}`
- Subsequent messages: `dingtalk:{senderId}:{timestamp}`

The `user` field in Gateway requests uses this sessionKey, allowing Gateway to maintain conversation context.

**Timeout Logic:**
```typescript
const elapsed = Date.now() - session.lastActivity;
if (elapsed > sessionTimeout) {
  // Create new session with timestamp
  return { sessionKey: `dingtalk:${senderId}:${now}`, isNew: true };
}
```

### AI Card Streaming

**Three-Phase Flow:**
1. **Create Card**: POST to `/v1.0/card/instances` with `callbackType: "STREAM"`
2. **Deliver Card**: POST to `/v1.0/card/instances/deliver` to conversation
3. **Stream Content**: PUT to `/v1.0/card/streaming` with throttled updates (300ms)
4. **Finish Card**: Final streaming call with `isFinalize: true`, then update status to `FINISHED`

**Card Template ID**: `382e4302-551d-4880-bf29-a30acfab2e71.schema`

**Card Status Values:**
- `1`: PROCESSING
- `2`: INPUTING (streaming state)
- `3`: FINISHED
- `4`: EXECUTING
- `5`: FAILED

### Gateway Communication

**SSE Parsing:**
```typescript
for await (const chunk of response.data) {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') return;

    const parsed = JSON.parse(data);
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) yield content;
  }
}
```

### Image Upload

**Detection Patterns:**
```typescript
// Markdown images: ![alt](file:///path)
const markdownImageRe = /!\[([^\]]*)\]\(((?:file:\/\/|MEDIA:|attachment:\/\/)[^\s)]+|\/(?:tmp|var|private|Users)[^\s)]+)\)/g;

// Bare paths: /tmp/xxx.png
const barePathRe = /`?(\/(?:tmp|var|private|Users)\/[^\s`'",)]+\.(?:png|jpg|jpeg|gif|bmp|webp))`?/gi;
```

**Upload Process:**
1. Detect image paths in content
2. Upload each to `https://oapi.dingtalk.com/media/upload`
3. Replace with `media_id`: `![alt](@media_id)`

## Common Tasks

### Adding a new message type

1. Add the type to `src/types/dingtalk.ts` (DingTalkMsgType)
2. Update `AICardService` to handle the new type if needed
3. Update message content extraction in `handleDingTalkMessage()`

### Changing session timeout

1. Update `SESSION_TIMEOUT` in `.env`
2. SessionManager reads this on initialization
3. No code changes needed

### Modifying AI Card template

1. Update `CARD_TEMPLATE_ID` in `src/services/ai-card.service.ts`
2. Ensure card data structure matches new template

### Adding new session commands

1. Add command to `NEW_SESSION_COMMANDS` array in `SessionManager.isNewSessionCommand()`

## Testing the Service

```bash
# Start the service
npm run dev

# Check logs for successful connections:
# - "DingTalk Stream WebSocket connected"
# - "AI Card service initialized"
# - "Media service initialized" (if enabled)
# - "MoltBot DingTalk Bridge is running"

# Send a message from DingTalk and watch logs:
# - "Processing message from {name} ({id}), session: {key}"
# - "Response sent to {conversationId}: {length} chars"

# Test new session:
# Send "/new" or "新会话"
# - "New session created for {senderId}: {sessionKey}"
```

## Reference

This project is based on and replicates functionality from [dingtalk-moltbot-connector](https://github.com/DingTalk-Real-AI/dingtalk-moltbot-connector).

## Important Notes

- **Not a webhook service**: This uses WebSocket Stream, not HTTP webhooks
- **Requires OpenClaw Gateway**: Connects to Gateway at `/v1/chat/completions` with SSE streaming
- **Enterprise app only**: Requires DingTalk enterprise internal app with Stream mode enabled
- **AI Card dependency**: Streaming feature requires DingTalk AI Card template to be available
- **Session persistence**: Relies on Gateway's `user` parameter for context management
