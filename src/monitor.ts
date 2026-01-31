import type { DingTalkConfig } from "./types.js";
import { getDingTalkRuntime, setDingTalkRuntime } from "./runtime.js";
import { startDingTalkBot, stopDingTalkBot, setDingTalkBotEnv } from "./bot.js";
import type { RuntimeEnv } from "openclaw/plugin-sdk";

let runtimeEnv: RuntimeEnv | null = null;

export interface MonitorDingTalkProviderParams {
  config: any;
  runtime: RuntimeEnv;
  abortSignal: AbortSignal;
  accountId: string;
}

/**
 * Monitor DingTalk provider (WebSocket connection)
 * This is the main entry point for starting the DingTalk WebSocket connection
 */
export async function monitorDingTalkProvider(
  params: MonitorDingTalkProviderParams,
): Promise<void> {
  const { config, runtime, abortSignal, accountId } = params;

  // Get DingTalk config
  const dingtalkCfg = config.channels?.dingtalk as DingTalkConfig | undefined;

  if (!dingtalkCfg) {
    throw new Error("DingTalk config not found");
  }

  // Log startup
  if (runtime.logger) {
    runtime.logger.info("[DingTalk] monitorDingTalkProvider starting");
  }

  // Set runtime environment
  runtimeEnv = runtime;
  setDingTalkBotEnv(runtime);

  // Set up DingTalk runtime with logger
  setDingTalkRuntime({
    config: dingtalkCfg,
    logger: {
      info: (...args: unknown[]) => {
        if (runtime.logger) {
          runtime.logger.info("[DingTalk]", ...args);
        }
      },
      warn: (...args: unknown[]) => {
        if (runtime.logger) {
          runtime.logger.warn("[DingTalk]", ...args);
        }
      },
      error: (...args: unknown[]) => {
        if (runtime.logger) {
          runtime.logger.error("[DingTalk]", ...args);
        }
      },
      debug: (...args: unknown[]) => {
        if (runtime.logger) {
          runtime.logger.debug("[DingTalk]", ...args);
        }
      },
    },
  });

  if (runtime.logger) {
    runtime.logger.info("[DingTalk] Starting WebSocket connection...");
  }

  // Start WebSocket connection
  try {
    await startDingTalkBot(dingtalkCfg);
  } catch (err) {
    if (runtime.logger) {
      runtime.logger.error("[DingTalk] Failed to start bot:", err);
    }
    throw err;
  }

  // Handle abort signal
  abortSignal.addEventListener("abort", () => {
    if (runtime.logger) {
      runtime.logger.info("[DingTalk] Abort signal received, stopping bot");
    }
    stopDingTalkBot();
  });

  if (runtime.logger) {
    runtime.logger.info("[DingTalk] Bot started, monitoring connection...");
  }

  // Keep the connection alive
  return new Promise((resolve) => {
    // This promise never resolves - the connection stays alive
    // until the abort signal is received
    abortSignal.addEventListener("abort", () => {
      if (runtime.logger) {
        runtime.logger.info("[DingTalk] Monitor ending");
      }
      resolve();
    });
  });
}
