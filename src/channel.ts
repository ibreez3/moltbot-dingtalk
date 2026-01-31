import type { ChannelPlugin } from "openclaw/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
} from "openclaw/plugin-sdk";
import type { DingTalkConfig, ResolvedDingTalkAccount } from "./types.js";
import { sendMessageDingTalk } from "./send.js";
import { normalizeDingTalkTarget, looksLikeDingTalkId } from "./targets.js";
import { probeDingTalk } from "./probe.js";

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

export const dingtalkPlugin: ChannelPlugin<ResolvedDingTalkAccount> = {
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
        cfg: cfg.channels?.dingtalk as DingTalkConfig,
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
    reply: true,
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
    resolveAccount: (cfg) => {
      const dingtalkCfg = cfg.channels?.dingtalk;
      const configured = !!(dingtalkCfg?.appKey && dingtalkCfg?.appSecret);

      return {
        accountId: DEFAULT_ACCOUNT_ID,
        type: "dingtalk",
        enabled: dingtalkCfg?.enabled ?? false,
        configured,
        appKey: dingtalkCfg?.appKey,
      } as ResolvedDingTalkAccount;
    },
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        dingtalk: {
          ...cfg.channels?.dingtalk,
          enabled,
        },
      },
    }),
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
      const defaultGroupPolicy = (cfg.channels as Record<string, { groupPolicy?: string }> | undefined)?.defaults?.groupPolicy;
      const groupPolicy = dingtalkCfg?.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      return [
        `- DingTalk groups: groupPolicy="open" allows any member to trigger (mention-gated). Set channels.dingtalk.groupPolicy="allowlist" + channels.dingtalk.groupAllowFrom to restrict senders.`,
      ];
    },
  },
  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        dingtalk: {
          ...cfg.channels?.dingtalk,
          enabled: true,
        },
      },
    }),
  },
  messaging: {
    normalizeTarget: normalizeDingTalkTarget,
    targetResolver: {
      looksLikeId: looksLikeDingTalkId,
      hint: "<conversationId>",
    },
  },
  outbound: {
    sendText: async ({ target, text }, { cfg }) => {
      return await sendMessageDingTalk({
        cfg: cfg.channels?.dingtalk as DingTalkConfig,
        conversationId: target,
        text,
      });
    },
    sendMarkdown: async ({ target, markdown }, { cfg }) => {
      return await sendMessageDingTalk({
        cfg: cfg.channels?.dingtalk as DingTalkConfig,
        conversationId: target,
        markdown,
      });
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      port: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      port: snapshot.port ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ cfg }) =>
      await probeDingTalk(cfg.channels?.dingtalk as DingTalkConfig | undefined),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      port: runtime?.port ?? null,
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const { monitorDingTalkProvider } = await import("./monitor.js");
      const dingtalkCfg = ctx.cfg.channels?.dingtalk as DingTalkConfig | undefined;
      ctx.log?.info(`starting dingtalk provider (mode: stream)`);
      return monitorDingTalkProvider({
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
      });
    },
  },
};
