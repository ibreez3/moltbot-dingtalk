import type { DingTalkConfig } from "./types.js";
import { createDingTalkClient } from "./client.js";
import { ensureDingTalkCredentials } from "./accounts.js";

export interface DingTalkProbeResult {
  ok: boolean;
  error?: string;
  appKey?: string;
  botName?: string;
  botUserId?: string;
}

/**
 * Probe DingTalk API to verify credentials and connectivity
 */
export async function probeDingTalk(cfg?: DingTalkConfig): Promise<DingTalkProbeResult> {
  const creds = ensureDingTalkCredentials(cfg);
  if (!creds) {
    return {
      ok: false,
      error: "missing credentials (appKey, appSecret)",
    };
  }

  try {
    const client = createDingTalkClient(cfg!);

    // Use the bot info API as a simple connectivity test
    const response = await client.getBotInfo();

    // DingTalk API response structure
    if (response.errcode !== 0) {
      return {
        ok: false,
        appKey: creds.appKey,
        error: `API error: ${response.errmsg || `code ${response.errcode}`}`,
      };
    }

    return {
      ok: true,
      appKey: creds.appKey,
      botName: response.botName,
      botUserId: response.botUserId,
    };
  } catch (err) {
    return {
      ok: false,
      appKey: creds.appKey,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
