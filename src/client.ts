import axios, { AxiosInstance } from "axios";
import { WebSocket } from "ws";
import { DingTalkConfig } from "./types.js";
import { ensureDingTalkCredentials } from "./accounts.js";

const DINGTALK_API_BASE = "https://api.dingtalk.com";
const DINGTALK_WS_BASE = "wss://ai-protocol-x.dingtalk.ai";

interface AccessTokenResponse {
  accessToken: string;
  expireIn: number;
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
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpireAt) {
      return this.accessToken;
    }

    const response = await this.axiosInstance.post<AccessTokenResponse>(
      "/v1.0/oauth2/accessToken",
      {
        appKey: this.appKey,
        appSecret: this.appSecret,
      },
    );

    if (response.data.accessToken) {
      this.accessToken = response.data.accessToken;
      // Set expiry to 5 minutes before actual expiry for safety
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
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<any> {
    return this.request("GET", `/v1.0/robot/messages/${messageId}`);
  }

  /**
   * Upload media file
   */
  async uploadMedia(file: Buffer, fileName: string): Promise<any> {
    const token = await this.getAccessToken();

    const formData = new FormData();
    formData.append("media", new Blob([file]), fileName);

    const response = await axios.post(
      `${DINGTALK_API_BASE}/v1.0/media/upload`,
      formData,
      {
        headers: {
          "x-acs-dingtalk-access-token": token,
        },
      },
    );

    return response.data;
  }

  /**
   * Get bot info
   */
  async getBotInfo(): Promise<any> {
    return this.request("GET", "/v1.0/robot/info");
  }
}

/**
 * DingTalk WebSocket client for receiving messages
 */
export class DingTalkWSClient {
  private ws: WebSocket | null = null;
  private appKey: string;
  private appSecret: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandler: ((data: any) => void) | null = null;

  constructor(cfg: DingTalkConfig) {
    const creds = ensureDingTalkCredentials(cfg);
    this.appKey = creds.appKey;
    this.appSecret = creds.appSecret;
  }

  /**
   * Connect to WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${DINGTALK_WS_BASE}?appKey=${encodeURIComponent(this.appKey)}`;

        this.ws = new WebSocket(url, {
          headers: {
            "app-Key": this.appKey,
            "app-Secret": this.appSecret,
          },
        });

        this.ws.on("open", () => {
          console.log("[DingTalk] WebSocket connected");
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            if (this.messageHandler) {
              this.messageHandler(message);
            }
          } catch (err) {
            console.error("[DingTalk] Failed to parse WebSocket message:", err);
          }
        });

        this.ws.on("error", (err) => {
          console.error("[DingTalk] WebSocket error:", err);
          reject(err);
        });

        this.ws.on("close", () => {
          console.log("[DingTalk] WebSocket closed");
          this.scheduleReconnect();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[DingTalk] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[DingTalk] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error("[DingTalk] Reconnection failed:", err);
      });
    }, delay);
  }

  /**
   * Set message handler
   */
  onMessage(handler: (data: any) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
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

export function createDingTalkWSClient(cfg: DingTalkConfig): DingTalkWSClient {
  return new DingTalkWSClient(cfg);
}

export function clearClientCache() {
  cachedClient = null;
  cachedConfig = null;
}
