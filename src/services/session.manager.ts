import { logger } from '../utils/logger.js';
import type { UserSession, SessionInfo } from '../types/session.js';

/**
 * Session Manager for handling user sessions and timeout
 */
export class SessionManager {
  private userSessions: Map<string, UserSession> = new Map();
  private sessionTimeout: number;

  constructor(sessionTimeout: number = 1800000) {
    // Default 30 minutes
    this.sessionTimeout = sessionTimeout;
  }

  /**
   * Get or create session key for a user
   */
  getSessionKey(senderId: string, forceNew: boolean = false): SessionInfo {
    const now = Date.now();

    if (forceNew) {
      // Force create new session
      const sessionId = `dingtalk:${senderId}:${now}`;
      this.userSessions.set(senderId, { lastActivity: now, sessionId });
      logger.info(`Created new session for ${senderId}: ${sessionId}`);
      return { sessionKey: sessionId, isNew: true };
    }

    const existing = this.userSessions.get(senderId);

    if (!existing) {
      // First message from this user
      const sessionId = `dingtalk:${senderId}`;
      this.userSessions.set(senderId, { lastActivity: now, sessionId });
      logger.info(`Created initial session for ${senderId}: ${sessionId}`);
      return { sessionKey: sessionId, isNew: true };
    }

    // Check timeout
    const elapsed = now - existing.lastActivity;
    if (elapsed > this.sessionTimeout) {
      // Session timeout, create new
      const sessionId = `dingtalk:${senderId}:${now}`;
      this.userSessions.set(senderId, { lastActivity: now, sessionId });
      logger.info(
        `Session timeout for ${senderId} (${Math.floor(elapsed / 1000)}s), created new: ${sessionId}`
      );
      return { sessionKey: sessionId, isNew: true };
    }

    // Update last activity and return existing session
    existing.lastActivity = now;
    return { sessionKey: existing.sessionId, isNew: false };
  }

  /**
   * Check if text is a new session command
   */
  static isNewSessionCommand(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    const commands = ['/new', '/reset', '/clear', '新会话', '重新开始', '清空对话'];
    return commands.some((cmd) => trimmed === cmd.toLowerCase());
  }

  /**
   * Clear all sessions (useful for testing)
   */
  clearAll(): void {
    this.userSessions.clear();
    logger.info('All sessions cleared');
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    // Clean up expired sessions first
    const now = Date.now();
    for (const [senderId, session] of this.userSessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.userSessions.delete(senderId);
      }
    }
    return this.userSessions.size;
  }
}
