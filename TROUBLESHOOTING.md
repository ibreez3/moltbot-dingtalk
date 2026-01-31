# 安装故障排查

如果遇到 `package.json missing openclaw.extensions` 错误，请按以下步骤操作：

## 1. 清理 OpenClaw 缓存

```bash
# 清理 OpenClaw 插件缓存
rm -rf ~/.openclaw/plugins/moltbot-dingtalk
rm -rf ~/.openclaw/cache/moltbot-dingtalk*

# 或者在 OpenClaw 目录
openclaw plugins remove moltbot-dingtalk
```

## 2. 清理 npm 缓存

```bash
npm cache clean --force
```

## 3. 重新安装

```bash
openclaw plugins install https://github.com/ibreez3/moltbot-dingtalk.git
```

## 4. 验证安装

```bash
openclaw plugins list
openclaw plugins status moltbot-dingtalk
```

## 验证 package.json

你可以手动验证 GitHub 上的 package.json 是否包含 `openclaw.extensions`：

```bash
curl -s https://raw.githubusercontent.com/ibreez3/moltbot-dingtalk/main/package.json | grep "openclaw.extensions"
```

应该看到：

```json
  "openclaw.extensions": {
```
