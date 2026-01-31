import type { DingTalkConfig } from "./types.js";
import { getDingTalkRuntime } from "./runtime.js";

export interface SendMessageParams {
  cfg: DingTalkConfig;
  to: string;
  text?: string;
  markdown?: {
    title: string;
    text: string;
  };
}

export async function sendMessageDingTalk({
  cfg,
  to,
  text,
  markdown,
}: SendMessageParams): Promise<void> {
  const runtime = getDingTalkRuntime();

  // TODO: Implement actual DingTalk message sending
  runtime.logger.info(`Sending message to DingTalk: ${to}`);

  if (text) {
    runtime.logger.debug(`Message text: ${text}`);
  }

  if (markdown) {
    runtime.logger.debug(`Message markdown: ${markdown.title}`);
  }
}
