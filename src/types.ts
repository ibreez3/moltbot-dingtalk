export interface DingTalkConfig {
  enabled?: boolean;
  appKey: string;
  appSecret: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  sessionTimeout?: number;
  enableMediaUpload?: boolean;
  systemPrompt?: string;
  dmPolicy?: "open" | "pairing" | "allowlist";
  allowFrom?: Array<string | number>;
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: Array<string | number>;
  requireMention?: boolean;
}

export interface DingTalkMessage {
  conversationId: string;
  conversationType: "1" | "2";
  senderId: string;
  senderNick: string;
  content: {
    text?: string;
    markdown?: {
      title: string;
      text: string;
    };
  };
  msgId: string;
  createAt: number;
  conversationTitle: string;
}

export interface DingTalkRuntime {
  config: DingTalkConfig;
  logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
}
