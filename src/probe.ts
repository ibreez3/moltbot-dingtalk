import axios from "axios";
import type { DingTalkConfig } from "./types.js";
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
 * Uses OAuth token endpoint as a simple connectivity test
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
    // Use the OAuth endpoint as a simple connectivity test
    // If we can get an access token, credentials are valid and API is reachable
    const response = await axios.post(
      "https://api.dingtalk.com/v1.0/oauth2/accessToken",
      {
        appKey: creds.appKey,
        appSecret: creds.appSecret,
      },
      {
        timeout: 10000,
      },
    );

    if (response.data && response.data.accessToken) {
      return {
        ok: true,
        appKey: creds.appKey,
      };
    }

    return {
      ok: false,
      appKey: creds.appKey,
      error: "Invalid response from OAuth endpoint",
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const statusCode = err.response?.status;
      const message = err.response?.data?.errorMessage || err.message;

      if (statusCode === 401) {
        return {
          ok: false,
          appKey: creds.appKey,
          error: "Authentication failed: invalid appKey or appSecret",
        };
      }

      return {
        ok: false,
        appKey: creds.appKey,
        error: `API error (${statusCode}): ${message}`,
      };
    }

    return {
      ok: false,
      appKey: creds.appKey,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
