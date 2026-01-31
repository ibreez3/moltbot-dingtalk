import type { DingTalkConfig, DingTalkSendResult } from "./types.js";
import {
  sendMessageDingTalk as sendMessageOutbound,
  sendTextDingTalk,
  sendMarkdownDingTalk,
  sendCardDingTalk,
} from "./outbound.js";

export interface SendMessageParams {
  cfg: DingTalkConfig;
  to: string;
  text?: string;
  markdown?: {
    title: string;
    text: string;
  };
  card?: any;
}

/**
 * Send message to DingTalk (convenience wrapper)
 */
export async function sendMessageDingTalk({
  cfg,
  to,
  text,
  markdown,
  card,
}: SendMessageParams): Promise<DingTalkSendResult> {
  return sendMessageOutbound({
    cfg,
    conversationId: to,
    text,
    markdown,
    card,
  });
}

// Re-export for direct access
export { sendTextDingTalk, sendMarkdownDingTalk, sendCardDingTalk };
export type { DingTalkSendResult };

