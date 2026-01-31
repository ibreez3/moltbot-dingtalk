import dotenv from 'dotenv';
import { DingTalkStreamService } from './services/dingtalk.stream.service.js';
import { SessionManager } from './services/session.manager.js';
import { OpenClawGateway } from './services/openclaw.gateway.js';
import { AICardService } from './services/ai-card.service.js';
import { MediaService } from './services/media.service.js';
import { logger } from './utils/logger.js';
import type { DingTalkStreamMessage } from './types/dingtalk.js';
import type { GatewayMessage } from './types/openclaw.js';

// Load environment variables
dotenv.config();

// Configuration from environment
const config = {
  dingtalk: {
    appKey: process.env.DINGTALK_APP_KEY || '',
    appSecret: process.env.DINGTALK_APP_SECRET || '',
    sessionTimeout: Number(process.env.SESSION_TIMEOUT) || 1800000, // 30 minutes
    enableMediaUpload: process.env.ENABLE_MEDIA_UPLOAD !== 'false',
    systemPrompt: process.env.SYSTEM_PROMPT,
    dmPolicy: (process.env.DM_POLICY as 'open' | 'closed') || 'open',
    groupPolicy: (process.env.GROUP_POLICY as 'open' | 'closed') || 'open',
    debug: process.env.DEBUG === 'true',
  },
  openclaw: {
    gatewayUrl: process.env.GATEWAY_URL || 'http://127.0.0.1:18789',
    gatewayToken: process.env.GATEWAY_TOKEN,
    gatewayPassword: process.env.GATEWAY_PASSWORD,
  },
};

class MoltBotDingTalkBridge {
  private dingTalkService: DingTalkStreamService;
  private sessionManager: SessionManager;
  private gateway: OpenClawGateway;
  private aiCardService: AICardService | null = null;
  private mediaService: MediaService | null = null;
  private conversationHistory: Map<string, GatewayMessage[]> = new Map();

  constructor() {
    const { appKey, appSecret } = config.dingtalk;

    if (!appKey || !appSecret) {
      throw new Error('DINGTALK_APP_KEY and DINGTALK_APP_SECRET are required');
    }

    this.dingTalkService = new DingTalkStreamService(appKey, appSecret);
    this.sessionManager = new SessionManager(config.dingtalk.sessionTimeout);
    this.gateway = new OpenClawGateway(
      config.openclaw.gatewayUrl,
      config.openclaw.gatewayToken,
      config.openclaw.gatewayPassword
    );

    if (config.dingtalk.enableMediaUpload) {
      // Media service will be initialized after getting access token
    }
  }

  /**
   * Handle message from DingTalk
   */
  async handleDingTalkMessage(dtMessage: DingTalkStreamMessage): Promise<void> {
    try {
      const {
        senderId,
        senderNick,
        conversationId,
        conversationType,
        content,
        msgtype,
      } = dtMessage;

      const isGroup = conversationType === '2';

      // Check policy
      if (isGroup && config.dingtalk.groupPolicy === 'closed') {
        logger.debug(`Group message ignored (policy: closed)`);
        return;
      }
      if (!isGroup && config.dingtalk.dmPolicy === 'closed') {
        logger.debug(`DM message ignored (policy: closed)`);
        return;
      }

      // Extract text content
      const textContent =
        msgtype === 'text' ? content.text || '' : content.markdown?.text || '';

      // Check for new session command
      if (SessionManager.isNewSessionCommand(textContent)) {
        await this.handleNewSession(senderId, conversationId, isGroup);
        return;
      }

      // Get or create session
      const { sessionKey, isNew } = this.sessionManager.getSessionKey(senderId);

      // Clear conversation history if new session
      if (isNew) {
        this.conversationHistory.delete(sessionKey);
      }

      // Build message array
      const messages = this.conversationHistory.get(sessionKey) || [];

      // Add user message
      const userMessage: GatewayMessage = {
        role: 'user',
        content: textContent,
      };
      messages.push(userMessage);

      // Build system prompts
      const systemPrompts: string[] = [];
      if (config.dingtalk.systemPrompt) {
        systemPrompts.push(config.dingtalk.systemPrompt);
      }
      if (config.dingtalk.enableMediaUpload) {
        systemPrompts.push(MediaService.buildMediaSystemPrompt());
      }

      const systemPrompt = systemPrompts.join('\n\n');

      logger.info(
        `Processing message from ${senderNick} (${senderId}), session: ${sessionKey}, new: ${isNew}`
      );

      // Process with streaming
      await this.processStreamingResponse(messages, sessionKey, conversationId, isGroup, {
        systemPrompt,
      });

      // Update conversation history with assistant response
      // (This will be done in processStreamingResponse)
    } catch (error) {
      logger.error('Error handling DingTalk message:', error);
    }
  }

  /**
   * Handle new session command
   */
  private async handleNewSession(
    senderId: string,
    conversationId: string,
    isGroup: boolean
  ): Promise<void> {
    const { sessionKey } = this.sessionManager.getSessionKey(senderId, true);
    this.conversationHistory.delete(sessionKey);

    const responseText = '✨ 已开启新会话，之前的对话已清空。';

    // Try to send via AI Card
    if (this.aiCardService) {
      const card = await this.aiCardService.createCard(conversationId, isGroup);
      if (card) {
        await this.aiCardService.finishCard(card, responseText);
        return;
      }
    }

    // Fallback to regular message
    await this.dingTalkService.sendToDingTalk(conversationId, {
      msgtype: 'text',
      text: { content: responseText },
    });

    logger.info(`New session created for ${senderId}: ${sessionKey}`);
  }

  /**
   * Process streaming response from Gateway
   */
  private async processStreamingResponse(
    messages: GatewayMessage[],
    sessionKey: string,
    conversationId: string,
    isGroup: boolean,
    options: { systemPrompt?: string }
  ): Promise<void> {
    // Try to create AI Card
    let card = await this.aiCardService?.createCard(conversationId, isGroup);

    let accumulatedResponse = '';
    let lastUpdateTime = 0;
    const updateInterval = 300; // 300ms between updates

    try {
      // Stream from Gateway
      for await (const chunk of this.gateway.streamChat(messages, sessionKey, options.systemPrompt)) {
        accumulatedResponse += chunk;

        // Throttled updates to AI Card
        const now = Date.now();
        if (card && now - lastUpdateTime >= updateInterval) {
          await this.aiCardService!.streamContent(card, accumulatedResponse, false);
          lastUpdateTime = now;
        }
      }

      // Finish AI Card or send final message
      if (card) {
        await this.aiCardService!.finishCard(card, accumulatedResponse);
      } else {
        // Fallback to regular message
        await this.dingTalkService.sendToDingTalk(conversationId, {
          msgtype: 'text',
          text: { content: accumulatedResponse },
        });
      }

      // Update conversation history
      const history = this.conversationHistory.get(sessionKey) || messages;
      history.push({
        role: 'assistant',
        content: accumulatedResponse,
      });
      this.conversationHistory.set(sessionKey, history);

      logger.info(`Response sent to ${conversationId}: ${accumulatedResponse.length} chars`);
    } catch (error) {
      logger.error('Error in streaming response:', error);

      // Send error message
      const errorMessage = '❌ 处理消息时出错，请稍后重试。';
      if (card) {
        await this.aiCardService!.finishCard(card, errorMessage);
      } else {
        await this.dingTalkService.sendToDingTalk(conversationId, {
          msgtype: 'text',
          text: { content: errorMessage },
        });
      }
    }
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    // Register token change callback to initialize services when token is available
    this.dingTalkService.onTokenChange((token) => {
      // Initialize AI Card service
      if (!this.aiCardService) {
        this.aiCardService = new AICardService(token);
        logger.info('AI Card service initialized');
      } else {
        this.aiCardService.setAccessToken(token);
      }

      // Initialize Media service if enabled
      if (config.dingtalk.enableMediaUpload) {
        if (!this.mediaService) {
          this.mediaService = new MediaService(token);
          logger.info('Media service initialized');
        } else {
          this.mediaService.setAccessToken(token);
        }
      }
    });

    logger.info('Services will be initialized after connection');
  }

  /**
   * Start the bridge
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting MoltBot DingTalk Bridge...');
      logger.info('Configuration:', {
        gatewayUrl: config.openclaw.gatewayUrl,
        sessionTimeout: config.dingtalk.sessionTimeout,
        enableMediaUpload: config.dingtalk.enableMediaUpload,
        dmPolicy: config.dingtalk.dmPolicy,
        groupPolicy: config.dingtalk.groupPolicy,
      });

      await this.initialize();

      // Connect to DingTalk Stream
      await this.dingTalkService.connect(async (dtMessage) => {
        await this.handleDingTalkMessage(dtMessage);
      });

      logger.info('MoltBot DingTalk Bridge is running');
      logger.info('Press Ctrl+C to stop');
    } catch (error) {
      logger.error('Failed to start bridge:', error);
      throw error;
    }
  }

  /**
   * Stop the bridge
   */
  stop(): void {
    logger.info('Stopping MoltBot DingTalk Bridge...');
    this.dingTalkService.disconnect();
    logger.info('Bridge stopped');
  }
}

// Start the bridge
const bridge = new MoltBotDingTalkBridge();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  bridge.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  bridge.stop();
  process.exit(0);
});

// Start the bridge
bridge.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
