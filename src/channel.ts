import type { ChannelPlugin } from "openclaw/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
} from "openclaw/plugin-sdk";
import type { DingTalkConfig } from "./types.js";
import { sendMessageDingTalk } from "./send.js";

const meta = {
  id: "dingtalk",
  label: "DingTalk",
  selectionLabel: "DingTalk (钉钉)",
  docsPath: "/channels/dingtalk",
  docsLabel: "dingtalk",
  blurb: "DingTalk enterprise messaging with AI Card streaming support.",
  aliases: ["钉钉"],
  order: 60,
} as const;

export const dingtalkPlugin: ChannelPlugin<DingTalkConfig> = {
  id: "dingtalk",
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "dingtalkUserId",
    normalizeAllowEntry: (entry) =>
      entry.replace(/^(dingtalk|user|userId):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      await sendMessageDingTalk({
        cfg,
        to: id,
        text: PAIRING_APPROVED_MESSAGE,
      });
    },
  },
  capabilities: {
    chatTypes: ["direct", "channel"],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: false,
  },
  agentPrompt: {
    messageToolHints: () => [
      "- DingTalk targeting: specify conversation ID to send to specific chat.",
      "- DingTalk supports AI Cards for rich interactive messages.",
    ],
  },
  groups: {
    resolveToolPolicy: (_cfg) => ({
      enabled: true,
    }),
  },
  reload: { configPrefixes: ["channels.dingtalk"] },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        appKey: { type: "string" },
        appSecret: { type: "string" },
        gatewayUrl: {
          type: "string",
          description: "OpenClaw Gateway URL",
        },
        gatewayToken: { type: "string" },
        gatewayPassword: { type: "string" },
        sessionTimeout: {
          type: "integer",
          minimum: 0,
          description: "Session timeout in milliseconds",
        },
        enableMediaUpload: { type: "boolean" },
        systemPrompt: { type: "string" },
        dmPolicy: {
          type: "string",
          enum: ["open", "pairing", "allowlist"],
        },
        allowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        groupPolicy: {
          type: "string",
          enum: ["open", "allowlist", "disabled"],
        },
        groupAllowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        requireMention: { type: "boolean" },
      },
      required: ["appKey", "appSecret"],
    },
  },
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg) => ({
      id: DEFAULT_ACCOUNT_ID,
      type: "dingtalk",
      ...cfg.channels?.dingtalk,
    }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        dingchat: {
          ...cfg.channels?.dingtalk,
          enabled,
        },
      },
    }),
  },
};
