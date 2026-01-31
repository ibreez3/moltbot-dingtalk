import WebSocket from 'ws';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import type { DingTalkStreamMessage, DingTalkSendMessage } from '../types/dingtalk.js';

export class DingTalkStreamService {
  private ws: WebSocket | null = null;
  private appKey: string;
  private appSecret: string;
  private accessToken: string = '';
  private reconnectInterval: NodeJS.Timeout | null = null;
  private messageCallback?: (message: DingTalkStreamMessage) => void;
  private tokenCallback?: (token: string) => void;

  constructor(appKey: string, appSecret: string) {
    this.appKey = appKey;
    this.appSecret = appSecret;
  }

  /**
   * Set token change callback
   */
  onTokenChange(callback: (token: string) => void): void {
    this.tokenCallback = callback;
  }

  /**
   * Get current access token
   */
  getCurrentAccessToken(): string {
    return this.accessToken;
  }

  /**
   * Fetch DingTalk access token from API
   */
  private async fetchAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.dingtalk.com/v1.0/oauth2/accessToken',
        {
          appId: this.appKey,
          appSecret: this.appSecret,
        }
      );

      if (response.data.accessToken) {
        this.accessToken = response.data.accessToken;
        // Notify token change
        if (this.tokenCallback) {
          this.tokenCallback(this.accessToken);
        }
        return this.accessToken;
      }

      throw new Error('No access token in response');
    } catch (error) {
      logger.error('Failed to get DingTalk access token:', error);
      throw error;
    }
  }

  /**
   * Connect to DingTalk Stream WebSocket
   */
  async connect(onMessage: (message: DingTalkStreamMessage) => void): Promise<void> {
    this.messageCallback = onMessage;

    try {
      const token = await this.fetchAccessToken();

      const wsUrl = `wss://data-api.dingtalk.com/stream?token=${token}`;
      logger.info(`Connecting to DingTalk Stream: ${wsUrl}`);

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'x-acs-dingtalk-access-token': token,
        },
      });

      this.ws.on('open', () => {
        logger.info('DingTalk Stream WebSocket connected');
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as DingTalkStreamMessage;
          logger.debug('Received message from DingTalk:', message);

          if (this.messageCallback) {
            this.messageCallback(message);
          }
        } catch (error) {
          logger.error('Failed to parse DingTalk message:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('DingTalk WebSocket error:', error);
      });

      this.ws.on('close', () => {
        logger.warn('DingTalk WebSocket disconnected, attempting to reconnect...');
        this.scheduleReconnect();
      });
    } catch (error) {
      logger.error('Failed to connect to DingTalk Stream:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(async () => {
      logger.info('Attempting to reconnect to DingTalk...');
      if (this.messageCallback) {
        await this.connect(this.messageCallback);
      }
    }, 5000);
  }

  /**
   * Send message to DingTalk
   */
  async sendToDingTalk(
    conversationId: string,
    message: DingTalkSendMessage
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://api.dingtalk.com/v1.0/robot/messages/send',
        {
          msgParam: JSON.stringify(message),
          msgKey: 'sample',
          conversationType: '1',
          conversationId,
        },
        {
          headers: {
            'x-acs-dingtalk-access-token': this.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Message sent to DingTalk:', response.data);
      return true;
    } catch (error) {
      logger.error('Failed to send message to DingTalk:', error);
      return false;
    }
  }

  /**
   * Disconnect from DingTalk Stream
   */
  disconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info('DingTalk Stream disconnected');
  }
}
