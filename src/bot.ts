import { DingTalkConfig, DingTalkMessageContext, DingTalkStreamMessage } from "./types.js";
import { getDingTalkRuntime } from "./runtime.js";
import { createDingTalkWSClient, type DingTalkWSClient } from "./client.js";
import { RuntimeEnv } from "openclaw/plugin-sdk";

let wsClient: DingTalkWSClient | null = null;
let runtimeEnv: RuntimeEnv | null = null;

export function setDingTalkBotEnv(env: RuntimeEnv): void {
  runtimeEnv = env;
}

/**
 * Handle incoming WebSocket bot message callback
 */
async function handleBotMessageCallback(event: DingTalkStreamMessage): Promise<void> {
  const runtime = getDingTalkRuntime();
  const cfg = runtime.config;

  if (!runtimeEnv) {
    runtime.logger.error("[DingTalk] Runtime environment not set");
    return;
  }

  try {
    // Parse the data field (it's a JSON string)
    const messageData = JSON.parse(event.data);

    const context = parseBotMessageContext(messageData);

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
  } catch (err) {
    runtime.logger.error("[DingTalk] Error handling bot message:", err);
  }
}

/**
 * Parse bot message callback data into message context
 */
function parseBotMessageContext(data: any): DingTalkMessageContext {
  // Extract text content
  let content = "";
  if (data.text?.content) {
    content = data.text.content;
  } else if (data.content) {
    content = String(data.content);
  }

  return {
    conversationId: data.conversationId || "",
    conversationType: data.conversationType || "1",
    senderId: data.senderId || "",
    senderNick: data.senderNick || "",
    msgId: data.msgId || "",
    content,
    mentionedBot: data.isInAtList || false,
    conversationTitle: data.conversationTitle,
    createdAt: data.createAt || Date.now(),
  };
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

  wsClient = createDingTalkWSClient(cfg, runtime.logger);

  // Register handler for bot message callbacks
  wsClient.onMessage("/v1.0/im/bot/messages/get", handleBotMessageCallback);

  await wsClient.connect();

  runtime.logger.info("[DingTalk] Bot started successfully");
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
