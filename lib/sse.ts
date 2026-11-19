type SSEEvent = "notification" | "invoice_update";

export function broadcastToUser(userId: string, event: SSEEvent, data: Record<string, unknown> = {}) {
  try {
    console.log(`[SSE] (stub) would emit "${event}" to user ${userId}`, data);
  } catch (err) {
    console.error("[SSE] broadcast failed:", err);
  }
}

export function broadcastToUsers(userIds: string[], event: SSEEvent, data: Record<string, unknown> = {}) {
  for (const id of new Set(userIds)) broadcastToUser(id, event, data);
}
