import axios from 'axios';
import { logger } from '../utils/logger.js';
import { AICardStatus, type AICardInstance } from '../types/ai-card.js';

/**
 * DingTalk AI Card Service
 * Handles AI Card creation, streaming updates, and finishing
 */
export class AICardService {
  private apiUrl = 'https://api.dingtalk.com';
  private accessToken: string;
  private readonly CARD_TEMPLATE_ID = '382e4302-551d-4880-bf29-a30acfab2e71.schema';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Set access token (for refresh)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Generate unique card instance ID
   */
  private generateCardInstanceId(): string {
    return `card_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Create AI Card instance
   */
  async createCard(
    conversationId: string,
    isGroup: boolean
  ): Promise<AICardInstance | null> {
    try {
      const cardInstanceId = this.generateCardInstanceId();

      // Create card instance
      await axios.post(
        `${this.apiUrl}/v1.0/card/instances`,
        {
          cardTemplateId: this.CARD_TEMPLATE_ID,
          outTrackId: cardInstanceId,
          cardData: {
            cardParamMap: {},
          },
          callbackType: 'STREAM',
        },
        {
          headers: {
            'x-acs-dingtalk-access-token': this.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Created AI Card: ${cardInstanceId}`);

      // Deliver card to conversation
      const openSpaceId = isGroup
        ? `dtv1.card//IM_GROUP.${conversationId}`
        : `dtv1.card//IM_ROBOT.${conversationId}`;

      await axios.post(
        `${this.apiUrl}/v1.0/card/instances/deliver`,
        {
          outTrackId: cardInstanceId,
          openSpaceId,
        },
        {
          headers: {
            'x-acs-dingtalk-access-token': this.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Delivered AI Card to: ${openSpaceId}`);

      return {
        cardInstanceId,
        inputingStarted: false,
      };
    } catch (error) {
      logger.error('Failed to create AI Card:', error);
      return null;
    }
  }

  /**
   * Update card to INPUTING status and start streaming
   */
  private async startInputing(card: AICardInstance): Promise<void> {
    if (card.inputingStarted) return;

    await axios.put(
      `${this.apiUrl}/v1.0/card/instances`,
      {
        outTrackId: card.cardInstanceId,
        cardData: {
          cardParamMap: {
            flowStatus: AICardStatus.INPUTING,
            msgContent: '',
            staticMsgContent: '',
            sys_full_json_obj: JSON.stringify({ order: ['msgContent'] }),
          },
        },
      },
      {
        headers: {
          'x-acs-dingtalk-access-token': this.accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    card.inputingStarted = true;
    logger.debug(`AI Card ${card.cardInstanceId} switched to INPUTING status`);
  }

  /**
   * Stream content to AI Card (typewriter effect)
   */
  async streamContent(
    card: AICardInstance,
    content: string,
    finished: boolean = false
  ): Promise<void> {
    // First call: switch to INPUTING status
    if (!card.inputingStarted) {
      await this.startInputing(card);
    }

    await axios.put(
      `${this.apiUrl}/v1.0/card/streaming`,
      {
        outTrackId: card.cardInstanceId,
        guid: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        key: 'msgContent',
        content: content,
        isFull: true, // Full replacement (not delta)
        isFinalize: finished,
        isError: false,
      },
      {
        headers: {
          'x-acs-dingtalk-access-token': this.accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.debug(`Streamed to AI Card ${card.cardInstanceId}: ${content.length} chars`);
  }

  /**
   * Finish AI Card streaming
   */
  async finishCard(card: AICardInstance, content: string): Promise<void> {
    // Final streaming call to close channel
    await this.streamContent(card, content, true);

    // Update status to FINISHED
    await axios.put(
      `${this.apiUrl}/v1.0/card/instances`,
      {
        outTrackId: card.cardInstanceId,
        cardData: {
          cardParamMap: {
            flowStatus: AICardStatus.FINISHED,
            msgContent: content,
            staticMsgContent: '',
            sys_full_json_obj: JSON.stringify({ order: ['msgContent'] }),
          },
        },
      },
      {
        headers: {
          'x-acs-dingtalk-access-token': this.accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`AI Card ${card.cardInstanceId} finished`);
  }

  /**
   * Stream content with throttling for typewriter effect
   */
  async *streamWithThrottle(): AsyncGenerator<string, void, unknown> {
    // This will be used in the main message handler
    // to control the streaming speed
    throw new Error('Use streamContent directly with throttled updates');
  }
}
