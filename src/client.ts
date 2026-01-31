import axios, { AxiosInstance } from "axios";
import { WebSocket } from "ws";
import { DingTalkConfig } from "./types.js";
import { ensureDingTalkCredentials } from "./accounts.js";

const DINGTALK_API_BASE = "https://api.dingtalk.com";

interface RegisterConnectionResponse {
  endpoint: string;
  ticket: string;
}

interface DingTalkStreamMessage {
  specVersion: string;
  type: "SYSTEM" | "EVENT" | "CALLBACK";
  headers: {
    topic: string;
    messageId: string;
    contentType: string;
    time: string;
    appId?: string;
    eventType?: string;
    eventId?: string;
  };
  data: string;
}

interface DingTalkStreamResponse {
  code: number;
  message: string;
  headers: {
    messageId: string;
    contentType: string;
  };
  data: string;
}

export class DingTalkClient {
  private axiosInstance: AxiosInstance;
  private appKey: string;
  private appSecret: string;
  private accessToken: string | null = null;
  private tokenExpireAt: number = 0;

  constructor(cfg: DingTalkConfig) {
    const creds = ensureDingTalkCredentials(cfg);

    this.appKey = creds.appKey;
    this.appSecret = creds.appSecret;

    this.axiosInstance = axios.create({
      baseURL: DINGTALK_API_BASE,
      timeout: 30000,
    });
  }

  /**
   * Get access token for API calls
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpireAt) {
      return this.accessToken;
    }

    const response = await this.axiosInstance.post<{
      accessToken: string;
      expireIn: number;
    }>("/v1.0/oauth2/accessToken", {
      appKey: this.appKey,
      appSecret: this.appSecret,
    });

    if (response.data.accessToken) {
      this.accessToken = response.data.accessToken;
      this.tokenExpireAt = Date.now() + (response.data.expireIn - 300) * 1000;
      return this.accessToken;
    }

    throw new Error("Failed to get access token");
  }

  /**
   * Make an authenticated API call
   */
  async request<T = any>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    data?: any,
    params?: any,
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await this.axiosInstance.request<T>({
      method,
      url: path,
      data,
      params,
      headers: {
        "x-acs-dingtalk-access-token": token,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  }

  /**
   * Send message to a conversation
   */
  async sendMessage(params: {
    conversationId: string;
    msgType: "text" | "markdown" | "interactiveCard";
    content: string;
  }): Promise<any> {
    return this.request("POST", "/v1.0/robot/messageMessages/send", {
      msgKey: params.conversationId,
      msgType: params.msgType,
      content: params.content,
    });
  }

  /**
   * Get bot info
   */
  async getBotInfo(): Promise<any> {
    return this.request("GET", "/v1.0/robot/info");
  }
}

/**
 * DingTalk Stream WebSocket client for receiving messages
 */
export class DingTalkWSClient {
  private ws: WebSocket | null = null;
  private appKey: string;
  private appSecret: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private messageHandlers: Map<string, (data: DingTalkStreamMessage) => void> = new Map();
  private runtimeLogger: any = null;

  constructor(cfg: DingTalkConfig, logger?: any) {
    const creds = ensureDingTalkCredentials(cfg);
    this.appKey = creds.appKey;
    this.appSecret = creds.appSecret;
    this.runtimeLogger = logger || console;
  }

  /**
   * Register Stream connection and get WebSocket endpoint
   */
  private async registerConnection(): Promise<{ endpoint: string; ticket: string }> {
    const response = await axios.post<RegisterConnectionResponse>(
      `${DINGTALK_API_BASE}/v1.0/gateway/connections/open`,
      {
        clientId: this.appKey,
        clientSecret: this.appSecret,
        subscriptions: [
          {
            topic: "*",
            type: "EVENT",
          },
          {
            topic: "/v1.0/im/bot/messages/get",
            type: "CALLBACK",
          },
        ],
        ua: "moltbot-dingtalk/1.0.0",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return {
      endpoint: response.data.endpoint,
      ticket: response.data.ticket,
    };
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    try {
      const { endpoint, ticket } = await this.registerConnection();

      this.runtimeLogger.info(`[DingTalk] Connecting to WebSocket: ${endpoint}`);

      this.ws = new WebSocket(`${endpoint}?ticket=${ticket}`);

      return new Promise((resolve, reject) => {
        if (!this.ws) return reject(new Error("WebSocket not initialized"));

        this.ws.on("open", () => {
          this.runtimeLogger.info("[DingTalk] WebSocket connected");
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on("error", (err) => {
          this.runtimeLogger.error("[DingTalk] WebSocket error:", err);
          reject(err);
        });

        this.ws.on("close", () => {
          this.runtimeLogger.warn("[DingTalk] WebSocket closed");
          this.scheduleReconnect();
        });

        // Connection timeout
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error("WebSocket connection timeout"));
          }
        }, 30000);
      });
    } catch (err) {
      this.runtimeLogger.error("[DingTalk] Failed to connect:", err);
      throw err;
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: Buffer): void {
    try {
      const message: DingTalkStreamMessage = JSON.parse(data.toString());
      const { type, headers, messageId } = message;

      this.runtimeLogger.debug(`[DingTalk] Received ${type} message: ${headers.topic}`);

      // Send ACK response
      this.sendAck(messageId, type, headers.topic);

      // Route to handlers based on type
      if (type === "SYSTEM") {
        this.handleSystemMessage(message);
      } else if (type === "CALLBACK") {
        const handler = this.messageHandlers.get(headers.topic);
        if (handler) {
          handler(message);
        }
      } else if (type === "EVENT") {
        const handler = this.messageHandlers.get("*");
        if (handler) {
          handler(message);
        }
      }
    } catch (err) {
      this.runtimeLogger.error("[DingTalk] Failed to handle message:", err);
    }
  }

  /**
   * Send ACK response
   */
  private sendAck(messageId: string, type: string, topic: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const response: DingTalkStreamResponse = {
      code: 200,
      message: "OK",
      headers: {
        messageId,
        contentType: "application/json",
      },
      data: type === "EVENT" ? JSON.stringify({ status: "SUCCESS", message: "success" }) : JSON.stringify({ response: null }),
    };

    this.ws.send(JSON.stringify(response));
  }

  /**
   * Handle system messages (ping, disconnect)
   */
  private handleSystemMessage(message: DingTalkStreamMessage): void {
    const { topic } = message.headers;

    if (topic === "ping") {
      // Ping is handled by sendAck
      this.runtimeLogger.debug("[DingTalk] Received ping");
    } else if (topic === "disconnect") {
      this.runtimeLogger.warn("[DingTalk] Received disconnect, reconnecting in 10s...");
      setTimeout(() => {
        this.scheduleReconnect();
      }, 10000);
    }
  }

  /**
   * Register message handler for a topic
   */
  onMessage(topic: string, handler: (data: DingTalkStreamMessage) => void): void {
    this.messageHandlers.set(topic, handler);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.runtimeLogger.error("[DingTalk] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(2, Math.pow(1.5, this.reconnectAttempts - 1));

    this.runtimeLogger.info(`[DingTalk] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((err) => {
        this.runtimeLogger.error("[DingTalk] Reconnection failed:", err);
      });
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
  }
}

let cachedClient: DingTalkClient | null = null;
let cachedConfig: { appKey: string; appSecret: string } | null = null;

export function createDingTalkClient(cfg: DingTalkConfig): DingTalkClient {
  const creds = ensureDingTalkCredentials(cfg);

  if (
    cachedClient &&
    cachedConfig &&
    cachedConfig.appKey === creds.appKey &&
    cachedConfig.appSecret === creds.appSecret
  ) {
    return cachedClient;
  }

  const client = new DingTalkClient(cfg);
  cachedClient = client;
  cachedConfig = { appKey: creds.appKey, appSecret: creds.appSecret };

  return client;
}

export function createDingTalkWSClient(cfg: DingTalkConfig, logger?: any): DingTalkWSClient {
  return new DingTalkWSClient(cfg, logger);
}

export function clearClientCache() {
  cachedClient = null;
  cachedConfig = null;
}
