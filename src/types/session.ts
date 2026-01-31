/**
 * Session Management Types
 */

export interface UserSession {
  sessionId: string; // Format: "dingtalk:{senderId}" or "dingtalk:{senderId}:{timestamp}"
  lastActivity: number;
}

export interface SessionInfo {
  sessionKey: string;
  isNew: boolean;
}
