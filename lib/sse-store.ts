const sseClients = new Map<string, Set<ReadableStreamController<Uint8Array>>>();

export function registerSSEClient(
  userId:     string,
  controller: ReadableStreamController<Uint8Array>
) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId)!.add(controller);
}

export function unregisterSSEClient(
  userId:     string,
  controller: ReadableStreamController<Uint8Array>
) {
  const set = sseClients.get(userId);
  if (set) {
    set.delete(controller);
    if (set.size === 0) sseClients.delete(userId);
  }
}

export function broadcastToUser(
  userId:    string,
  eventType: string,
  data:      Record<string, unknown>
): number {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return 0;

  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  const dead    = new Set<ReadableStreamController<Uint8Array>>();

  for (const controller of clients) {
    try {
      controller.enqueue(encoded);
    } catch {
      dead.add(controller);
    }
  }

  dead.forEach((c) => clients.delete(c));
  if (clients.size === 0) sseClients.delete(userId);

  return clients.size;
}

export function getConnectedClientCount(): number {
  let total = 0;
  sseClients.forEach((s) => { total += s.size; });
  return total;
}
