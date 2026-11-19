import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { registerSSEClient, unregisterSSEClient } from "@/lib/sse-store";

export const dynamic = "force-dynamic";

function broadcastInvoiceUpdate(entityId?: string) {
  const msg = `event: invoice_update\ndata: ${JSON.stringify({ type: "INVOICE_UPDATE", entityId, ts: Date.now() })}\n\n`;

  const globalStore = (global as any)._sseClients;
  if (globalStore instanceof Map) {
    globalStore.forEach((controller: any) => {
      try {
        controller.enqueue(new TextEncoder().encode(msg));
      } catch {
      }
    });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;
  let heartbeat: NodeJS.Timeout;

  const stream = new ReadableStream({
    start(controller) {
      registerSSEClient(userId, controller as any);

      const connected = `event: connected\ndata: ${JSON.stringify({ type: "INVOICE_STREAM_CONNECTED", userId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connected));

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unregisterSSEClient(userId, controller as any);
        }
      }, 25000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unregisterSSEClient(userId, stream as any);
    },
  });

  req.signal.addEventListener("abort", () => {
    if (heartbeat) clearInterval(heartbeat);
    unregisterSSEClient(userId, stream as any);
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
