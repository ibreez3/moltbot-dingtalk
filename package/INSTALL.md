# Installation Guide

## OpenClaw Plugin Installation

### Option 1: Install from local directory

```bash
# Navigate to your OpenClaw installation
cd /path/to/openclaw

# Install the plugin from local directory
openclaw plugins install /path/to/moltbot-dingtalk
```

### Option 2: Install from git repository

```bash
# If you have this in a git repository
openclaw plugins install https://github.com/your-username/moltbot-dingtalk.git
```

### Option 3: Manual installation

```bash
# Clone the repository
git clone https://github.com/your-username/moltbot-dingtalk.git
cd moltbot-dingtalk

# Install dependencies
npm install

# Build the project
npm run build

# Copy to OpenClaw plugins directory
cp -r . /path/to/openclaw/plugins/moltbot-dingtalk
```

## Configuration

After installation, configure the plugin in OpenClaw's configuration file (usually `openclaw.json`):

```json
{
  "plugins": {
    "moltbot-dingtalk": {
      "enabled": true,
      "config": {
        "dingtalk": {
          "enabled": true,
          "clientId": "your_dingtalk_app_key",
          "clientSecret": "your_dingtalk_app_secret",
          "gatewayToken": "",
          "gatewayPassword": "",
          "sessionTimeout": 1800000,
          "enableMediaUpload": true,
          "systemPrompt": "You are a helpful AI assistant.",
          "dmPolicy": "open",
          "groupPolicy": "open",
          "debug": false
        }
      }
    }
  }
}
```

## Environment Variables

Alternatively, you can use environment variables (create a `.env` file in the plugin directory):

```env
DINGTALK_APP_KEY=your_dingtalk_app_key
DINGTALK_APP_SECRET=your_dingtalk_app_secret
GATEWAY_URL=http://127.0.0.1:18789
GATEWAY_TOKEN=
GATEWAY_PASSWORD=
SESSION_TIMEOUT=1800000
DM_POLICY=open
GROUP_POLICY=open
ENABLE_MEDIA_UPLOAD=true
SYSTEM_PROMPT=
DEBUG=false
```

## Verify Installation

```bash
# Check if plugin is installed
openclaw plugins list

# Check plugin status
openclaw plugins status moltbot-dingtalk

# Start OpenClaw with the plugin
openclaw start
```

## Troubleshooting

### Plugin not loading

1. Check if the plugin is built (`dist/` directory exists)
2. Verify `openclaw.plugin.json` is valid JSON
3. Check OpenClaw logs: `openclaw logs`

### DingTalk connection failed

1. Verify `clientId` and `clientSecret` are correct
2. Check if the bot is added to the target conversations
3. Ensure network connectivity to DingTalk API

### Gateway connection failed

1. Verify Gateway URL is correct
2. Check if Gateway is running
3. Verify authentication tokens if configured
