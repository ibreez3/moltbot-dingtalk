import type { ClawdbotPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { dingtalkPlugin } from "./src/channel.js";
import { setDingTalkRuntime } from "./src/runtime.js";

export { sendMessageDingTalk } from "./src/send.js";
export { dingtalkPlugin } from "./src/channel.js";

const plugin = {
  id: "moltbot-dingtalk",
  name: "DingTalk",
  description: "DingTalk enterprise messaging with AI Card streaming support.",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setDingTalkRuntime(api.runtime);
    api.registerChannel({ plugin: dingtalkPlugin });
  },
};

export default plugin;
