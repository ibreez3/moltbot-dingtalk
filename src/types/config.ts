/**
 * Configuration Types
 */

export interface OpenClawConfig {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
}

export interface DingTalkConfig {
  appKey: string;
  appSecret: string;
  sessionTimeout: number; // milliseconds, default 30 minutes
  enableMediaUpload: boolean;
  systemPrompt?: string;
  dmPolicy: 'open' | 'closed';
  groupPolicy: 'open' | 'closed';
  debug: boolean;
}

export interface AppConfig {
  openclaw: OpenClawConfig;
  dingtalk: DingTalkConfig;
}
