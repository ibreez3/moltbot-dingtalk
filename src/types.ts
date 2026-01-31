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

export interface ResolvedDingTalkAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  appKey?: string;
}

export type DingTalkConversationType = "1" | "2"; // 1 = DM, 2 = Group

export interface DingTalkMessage {
  conversationId: string;
  conversationType: DingTalkConversationType;
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

export interface DingTalkMessageContext {
  conversationId: string;
  conversationType: DingTalkConversationType;
  senderId: string;
  senderNick?: string;
  msgId: string;
  content: string;
  mentionedBot: boolean;
  conversationTitle?: string;
  createdAt: number;
}

export interface DingTalkSendResult {
  msgId: string;
  conversationId: string;
}

export interface DingTalkOutboundMessage {
  conversationId: string;
  msgType: "text" | "markdown" | "interactiveCard";
  content: string;
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

// WebSocket event types
export interface DingTalkWSMessageEvent {
  eventType: string;
  msgId: string;
  conversationId: string;
  conversationType: DingTalkConversationType;
  senderId: string;
  senderNick: string;
  content: {
    text?: string;
    markdown?: string;
  };
  createAt: number;
  conversationTitle?: string;
}

export interface DingTalkWSEvent {
  type: string;
  data: DingTalkWSMessageEvent;
}
