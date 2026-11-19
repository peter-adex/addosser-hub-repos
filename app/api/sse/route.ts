import { NextRequest } from "next/server";
import {
  registerSSEClient,
  unregisterSSEClient,
} from "@/lib/sse-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response("Missing userId parameter", { status: 400 });
  }

  let controller: ReadableStreamController<Uint8Array>;

  let heartbeatInterval: NodeJS.Timeout;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;

      registerSSEClient(userId, controller);

      const connectedMsg = `event: connected\ndata: ${JSON.stringify({ type: "CONNECTED", userId, ts: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectedMsg));

      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            new TextEncoder().encode(": keepalive heartbeat\n\n"),
          );
        } catch {
          clearInterval(heartbeatInterval);
          unregisterSSEClient(userId, controller);
        }
      }, 30000);
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      unregisterSSEClient(userId, controller);
    },
  });

  req.signal.addEventListener("abort", () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    unregisterSSEClient(userId, controller);
    try {
      controller.close();
    } catch {}
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
