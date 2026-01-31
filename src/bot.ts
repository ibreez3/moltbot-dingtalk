import type { DingTalkConfig, DingTalkMessageContext, DingTalkWSEvent } from "./types.js";
import { getDingTalkRuntime } from "./runtime.js";
import { createDingTalkWSClient } from "./client.js";
import type { RuntimeEnv } from "openclaw/plugin-sdk";

let wsClient: ReturnType<typeof createDingTalkWSClient> | null = null;
let runtimeEnv: RuntimeEnv | null = null;

export function setDingTalkBotEnv(env: RuntimeEnv): void {
  runtimeEnv = env;
}

/**
 * Handle incoming WebSocket message event
 */
async function handleMessageEvent(event: DingTalkWSEvent): Promise<void> {
  const runtime = getDingTalkRuntime();
  const cfg = runtime.config;

  if (!runtimeEnv) {
    runtime.logger.error("[DingTalk] Runtime environment not set");
    return;
  }

  const message = event.data;
  const context = parseMessageContext(message);

  // Check DM policy
  if (context.conversationType === "1") {
    const dmPolicy = cfg.dmPolicy || "open";
    if (dmPolicy === "allowlist") {
      const allowFrom = cfg.allowFrom || [];
      if (!allowFrom.includes(context.senderId)) {
        runtime.logger.info(
          `[DingTalk] DM from ${context.senderId} not in allowlist, ignoring`,
        );
        return;
      }
    }
  }

  // Check group policy
  if (context.conversationType === "2") {
    const groupPolicy = cfg.groupPolicy || "open";
    if (groupPolicy === "disabled") {
      runtime.logger.info(
        `[DingTalk] Group message from ${context.conversationId} ignored (group policy disabled)`,
      );
      return;
    }
    if (groupPolicy === "allowlist") {
      const groupAllowFrom = cfg.groupAllowFrom || [];
      if (!groupAllowFrom.includes(context.conversationId)) {
        runtime.logger.info(
          `[DingTalk] Group message from ${context.conversationId} not in allowlist, ignoring`,
        );
        return;
      }
    }

    // Check if bot is mentioned in group
    if (cfg.requireMention && !context.mentionedBot) {
      runtime.logger.debug(
        `[DingTalk] Group message without mention, ignoring (requireMention enabled)`,
      );
      return;
    }
  }

  // Route to OpenClaw runtime
  runtime.logger.info(
    `[DingTalk] Routing message from ${context.senderId} in ${context.conversationId}`,
  );

  await runtimeEnv.inbound({
    channelId: "dingtalk",
    accountId: "default",
    target: {
      conversationId: context.conversationId,
      conversationType: context.conversationType,
    },
    message: {
      text: context.content,
      senderId: context.senderId,
      senderName: context.senderNick,
      messageId: context.msgId,
      timestamp: context.createdAt,
    },
  });
}

/**
 * Parse WebSocket message event into message context
 */
function parseMessageContext(event: any): DingTalkMessageContext {
  const content = parseContent(event.content);

  return {
    conversationId: event.conversationId || "",
    conversationType: event.conversationType || "1",
    senderId: event.senderId || "",
    senderNick: event.senderNick || "",
    msgId: event.msgId || "",
    content,
    mentionedBot: event.mentionedBot || false,
    conversationTitle: event.conversationTitle,
    createdAt: event.createAt || Date.now(),
  };
}

/**
 * Parse message content
 */
function parseContent(content: any): string {
  if (typeof content === "string") {
    return content;
  }

  if (content?.text) {
    return content.text;
  }

  if (content?.markdown) {
    return content.markdown;
  }

  return "";
}

/**
 * Start DingTalk WebSocket connection
 */
export async function startDingTalkBot(cfg: DingTalkConfig): Promise<void> {
  const runtime = getDingTalkRuntime();

  if (wsClient) {
    runtime.logger.info("[DingTalk] WebSocket already running, stopping first");
    await stopDingTalkBot();
  }

  runtime.logger.info("[DingTalk] Starting WebSocket connection...");

  wsClient = createDingTalkWSClient(cfg);

  wsClient.onMessage((data: DingTalkWSEvent) => {
    handleMessageEvent(data).catch((err) => {
      runtime.logger.error("[DingTalk] Error handling message:", err);
    });
  });

  await wsClient.connect();
}

/**
 * Stop DingTalk WebSocket connection
 */
export async function stopDingTalkBot(): Promise<void> {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}

/**
 * Check if bot is running
 */
export function isDingTalkBotRunning(): boolean {
  return wsClient !== null;
}
