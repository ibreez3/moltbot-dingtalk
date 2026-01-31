import type { DingTalkConfig, DingTalkSendResult } from "./types.js";
import { createDingTalkClient } from "./client.js";

export interface DingTalkOutboundTextParams {
  cfg: DingTalkConfig;
  conversationId: string;
  text: string;
}

export interface DingTalkOutboundMarkdownParams {
  cfg: DingTalkConfig;
  conversationId: string;
  title: string;
  text: string;
}

export interface DingTalkOutboundCardParams {
  cfg: DingTalkConfig;
  conversationId: string;
  card: any; // DingTalk card JSON
}

/**
 * Send a text message
 */
export async function sendTextDingTalk(
  params: DingTalkOutboundTextParams,
): Promise<DingTalkSendResult> {
  const client = createDingTalkClient(params.cfg);

  const content = JSON.stringify({
    text: params.text,
  });

  const response = await client.sendMessage({
    conversationId: params.conversationId,
    msgType: "text",
    content,
  });

  return {
    msgId: response.msgId || "",
    conversationId: params.conversationId,
  };
}

/**
 * Send a markdown message
 */
export async function sendMarkdownDingTalk(
  params: DingTalkOutboundMarkdownParams,
): Promise<DingTalkSendResult> {
  const client = createDingTalkClient(params.cfg);

  const content = JSON.stringify({
    title: params.title,
    text: params.text,
  });

  const response = await client.sendMessage({
    conversationId: params.conversationId,
    msgType: "markdown",
    content,
  });

  return {
    msgId: response.msgId || "",
    conversationId: params.conversationId,
  };
}

/**
 * Send an interactive card message
 */
export async function sendCardDingTalk(
  params: DingTalkOutboundCardParams,
): Promise<DingTalkSendResult> {
  const client = createDingTalkClient(params.cfg);

  const content = JSON.stringify(params.card);

  const response = await client.sendMessage({
    conversationId: params.conversationId,
    msgType: "interactiveCard",
    content,
  });

  return {
    msgId: response.msgId || "",
    conversationId: params.conversationId,
  };
}

/**
 * Send a message (auto-detect format based on content)
 */
export async function sendMessageDingTalk(params: {
  cfg: DingTalkConfig;
  conversationId: string;
  text?: string;
  markdown?: { title: string; text: string };
  card?: any;
}): Promise<DingTalkSendResult> {
  if (params.card) {
    return sendCardDingTalk({
      cfg: params.cfg,
      conversationId: params.conversationId,
      card: params.card,
    });
  }

  if (params.markdown) {
    return sendMarkdownDingTalk({
      cfg: params.cfg,
      conversationId: params.conversationId,
      title: params.markdown.title,
      text: params.markdown.text,
    });
  }

  if (params.text) {
    return sendTextDingTalk({
      cfg: params.cfg,
      conversationId: params.conversationId,
      text: params.text,
    });
  }

  throw new Error("Must provide one of: text, markdown, or card");
}
