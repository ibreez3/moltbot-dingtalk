import axios from 'axios';
import { logger } from '../utils/logger.js';
import type { GatewayRequest, GatewayMessage } from '../types/openclaw.js';

/**
 * OpenClaw Gateway Client
 * Connects to Gateway API with SSE streaming support
 */
export class OpenClawGateway {
  private gatewayUrl: string;
  private gatewayToken?: string;
  private gatewayPassword?: string;

  constructor(gatewayUrl: string, gatewayToken?: string, gatewayPassword?: string) {
    this.gatewayUrl = gatewayUrl;
    this.gatewayToken = gatewayToken;
    this.gatewayPassword = gatewayPassword;
  }

  /**
   * Stream chat completion from Gateway
   */
  async *streamChat(
    messages: GatewayMessage[],
    sessionKey: string,
    systemPrompt?: string
  ): AsyncGenerator<string, void, unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication if provided
    if (this.gatewayToken) {
      headers['Authorization'] = `Bearer ${this.gatewayToken}`;
    } else if (this.gatewayPassword) {
      headers['Authorization'] = `Bearer ${this.gatewayPassword}`;
    }

    // Build message array with system prompts
    const allMessages: GatewayMessage[] = [];
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }
    allMessages.push(...messages);

    const requestBody: GatewayRequest = {
      model: 'default',
      messages: allMessages,
      stream: true,
      user: sessionKey,
    };

    logger.debug(`Sending request to Gateway: ${this.gatewayUrl}/v1/chat/completions`);

    try {
      const response = await axios.post(`${this.gatewayUrl}/v1/chat/completions`, requestBody, {
        headers,
        responseType: 'stream',
      });

      const stream = response.data;
      let buffer = '';

      // Process SSE stream
      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            logger.debug('Gateway stream completed');
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            logger.debug('Failed to parse SSE chunk:', e);
          }
        }
      }
    } catch (error) {
      logger.error('Gateway streaming error:', error);
      throw error;
    }
  }

  /**
   * Non-streaming chat completion (fallback)
   */
  async chatCompletion(
    messages: GatewayMessage[],
    sessionKey: string,
    systemPrompt?: string
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.gatewayToken) {
      headers['Authorization'] = `Bearer ${this.gatewayToken}`;
    } else if (this.gatewayPassword) {
      headers['Authorization'] = `Bearer ${this.gatewayPassword}`;
    }

    const allMessages: GatewayMessage[] = [];
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }
    allMessages.push(...messages);

    const requestBody: GatewayRequest = {
      model: 'default',
      messages: allMessages,
      stream: true,
      user: sessionKey,
    };

    const response = await axios.post(`${this.gatewayUrl}/v1/chat/completions`, requestBody, {
      headers,
    });

    // Accumulate streaming response
    let fullContent = '';
    const stream = response.data;
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    return fullContent;
  }
}
