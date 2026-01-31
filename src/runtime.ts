import type { DingTalkRuntime } from "./types.js";

let runtime: DingTalkRuntime | null = null;

export function setDingTalkRuntime(newRuntime: DingTalkRuntime): void {
  runtime = newRuntime;
}

export function getDingTalkRuntime(): DingTalkRuntime {
  if (!runtime) {
    throw new Error("DingTalk runtime not initialized");
  }
  return runtime;
}
