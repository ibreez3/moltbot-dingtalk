# MoltBot DingTalk Channel

OpenClaw DingTalk channel plugin - AI Card streaming with session management.

## Features

- **AI Card Streaming** - Real-time typewriter effect for AI responses
- **Session Persistence** - Multi-round conversations share context
- **Auto New Session** - 30-minute timeout automatically starts new conversation
- **Manual New Session** - Commands like `/new`, `新会话` to clear history
- **Image Upload** - Automatic upload of local image paths to DingTalk
- **Policy Control** - Separate policies for DM and group messages

## Installation

### Via OpenClaw

```bash
openclaw plugins install https://github.com/ibreez3/moltbot-dingtalk.git
```

### Configuration

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "moltbot-dingtalk": {
      "enabled": true,
      "config": {
        "appKey": "your_dingtalk_app_key",
        "appSecret": "your_dingtalk_app_secret",
        "gatewayUrl": "http://127.0.0.1:18789",
        "sessionTimeout": 1800000,
        "enableMediaUpload": true,
        "dmPolicy": "open",
        "groupPolicy": "open"
      }
    }
  }
}
```

## Environment Variables

Or use environment variables:

```env
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
GATEWAY_URL=http://127.0.0.1:18789
```

## Session Management

### Session Key Format

- First message: `dingtalk:{senderId}`
- Subsequent messages: `dingtalk:{senderId}:{timestamp}`

### Timeout

- Default: 30 minutes (1800000ms)
- Configurable via `sessionTimeout`

### Manual New Session

Supported commands:
- `/new`
- `/reset`
- `/clear`
- `新会话`
- `重新开始`
- `清空对话`

## Architecture

```
DingTalk User/Group <--WebSocket(Stream)--> OpenClaw <--HTTP SSE--> Gateway
                                                    ↓
                                              AI Card Streaming
```

## Development

```bash
# Clone repository
git clone https://github.com/ibreez3/moltbot-dingtalk.git
cd moltbot-dingtalk

# Install dependencies
npm install

# Type check
npx tsc --noEmit
```

## License

ISC
