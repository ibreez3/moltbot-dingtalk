/**
 * Normalize DingTalk conversation ID to a standard format
 */
export function normalizeDingTalkTarget(target: string): string {
  if (!target) return target;

  // Remove any common prefixes
  let normalized = target.replace(/^dingtalk:/i, "");
  normalized = normalized.replace(/^conv:/i, "");
  normalized = normalized.replace(/^conversation:/i, "");

  return normalized;
}

/**
 * Check if a string looks like a DingTalk conversation ID
 */
export function looksLikeDingTalkId(id: string): boolean {
  if (!id) return false;

  // DingTalk conversation IDs are typically "cid" followed by alphanumeric
  // Format: cidxxxxx or just a long alphanumeric string
  return /^cid[a-zA-Z0-9]+$/.test(id) || /^[a-zA-Z0-9]{10,}$/.test(id);
}

/**
 * Format a conversation ID for use in messages
 */
export function formatDingTalkTarget(conversationId: string): string {
  return normalizeDingTalkTarget(conversationId);
}

/**
 * Build a message target object
 */
export interface DingTalkTarget {
  conversationId: string;
  conversationType: "1" | "2"; // 1 = DM, 2 = Group
}

export function buildDingTalkTarget(params: {
  conversationId: string;
  conversationType?: "1" | "2";
}): DingTalkTarget {
  return {
    conversationId: normalizeDingTalkTarget(params.conversationId),
    conversationType: params.conversationType || "1",
  };
}

/**
 * Parse a target string into its components
 */
export function parseDingTalkTarget(target: string): DingTalkTarget | null {
  const normalized = normalizeDingTalkTarget(target);

  if (!looksLikeDingTalkId(normalized)) {
    return null;
  }

  // Default to DM (type 1) if not specified
  return {
    conversationId: normalized,
    conversationType: "1",
  };
}
