/**
 * DingTalk Stream Message Types
 * Reference: https://open.dingtalk.com/document/orgapp/receive-message-by-stream-mode
 */

export type DingTalkMsgType = 'text' | 'markdown' | 'actionCard' | 'feedCard';

export interface DingTalkStreamMessage {
  conversationId: string;
  conversationType: '1' | '2'; // 1: 单聊, 2: 群聊
  chatbotUserId: string;
  senderId: string;
  senderNick: string;
  msgtype: DingTalkMsgType;
  msgId: string;
  createAt: number;
  conversationTitle: string;
  content: DingTalkMessageContent;
  senderCorpId?: string;
  isAdmin?: boolean;
  sessionWebhook?: string;
}

export interface DingTalkMessageContent {
  text?: string;
  markdown?: {
    title: string;
    text: string;
  };
}

export interface DingTalkSendMessage {
  msgtype: DingTalkMsgType;
  text?: {
    content: string;
  };
  markdown?: {
    title: string;
    text: string;
  };
  msgKey?: string; // For actionCard
  cardData?: Record<string, unknown>; // For actionCard
}

export interface DingTalkSendParams {
  conversationId: string;
  msgKey?: string;
  msgParam?: string;
  openConversationId?: string;
  userIds?: string[];
  robotCode: string;
}
