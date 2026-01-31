/**
 * OpenClaw Gateway Types
 */

export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GatewayRequest {
  model: string;
  messages: GatewayMessage[];
  stream: true;
  user: string; // Session key for context persistence
}

export interface GatewayStreamChunk {
  choices: Array<{
    delta?: {
      content?: string;
    };
  }>;
}
