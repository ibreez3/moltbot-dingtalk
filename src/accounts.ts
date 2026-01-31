import type { DingTalkConfig } from "./types.js";

export interface ResolvedDingTalkCredentials {
  appKey: string;
  appSecret: string;
}

export function resolveDingTalkCredentials(
  cfg: DingTalkConfig,
): ResolvedDingTalkCredentials | undefined {
  if (!cfg.appKey || !cfg.appSecret) {
    return undefined;
  }
  return {
    appKey: cfg.appKey,
    appSecret: cfg.appSecret,
  };
}

export function ensureDingTalkCredentials(
  cfg: DingTalkConfig,
): ResolvedDingTalkCredentials {
  const creds = resolveDingTalkCredentials(cfg);
  if (!creds) {
    throw new Error("DingTalk credentials not configured (appKey, appSecret required)");
  }
  return creds;
}
