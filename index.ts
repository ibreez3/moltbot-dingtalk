import type { ClawdbotPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { dingtalkPlugin } from "./src/channel.js";
import { setDingTalkRuntime } from "./src/runtime.js";

// Core exports
export { dingtalkPlugin } from "./src/channel.js";
export { setDingTalkRuntime, getDingTalkRuntime } from "./src/runtime.js";

// Client exports
export {
  createDingTalkClient,
  createDingTalkWSClient,
  clearClientCache,
} from "./src/client.js";

// Message sending exports
export {
  sendMessageDingTalk,
  sendTextDingTalk,
  sendMarkdownDingTalk,
  sendCardDingTalk,
} from "./src/send.js";

// Bot exports
export {
  startDingTalkBot,
  stopDingTalkBot,
  isDingTalkBotRunning,
  setDingTalkBotEnv,
} from "./src/bot.js";

// Monitor export
export { monitorDingTalkProvider } from "./src/monitor.js";

// Probe export
export { probeDingTalk } from "./src/probe.js";

// Target exports
export {
  normalizeDingTalkTarget,
  looksLikeDingTalkId,
  formatDingTalkTarget,
  buildDingTalkTarget,
  parseDingTalkTarget,
} from "./src/targets.js";

// Type exports
export type {
  DingTalkConfig,
  ResolvedDingTalkAccount,
  DingTalkMessage,
  DingTalkMessageContext,
  DingTalkSendResult,
  DingTalkOutboundMessage,
  DingTalkRuntime,
  DingTalkStreamMessage,
  DingTalkProbeResult,
} from "./src/types.js";

const plugin = {
  id: "moltbot-dingtalk",
  name: "DingTalk",
  description: "DingTalk enterprise messaging with AI Card streaming support.",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setDingTalkRuntime({
      config: api.config.channels?.dingtalk || {},
      logger: api.logger,
    });
    api.registerChannel({ plugin: dingtalkPlugin });
  },
};

export default plugin;
