import { prisma } from "./prisma";
<<<<<<< HEAD
import { NextRequest } from "next/server";
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

interface AuditParams {
  userId: string;
  action: string;
  module: string;
  entityId?: string;
  resourceId?: string;
<<<<<<< HEAD
  resourceType?: string;
  beforeData?: string;
  afterData?: string;
  meta?: Record<string, unknown>;
  req?: NextRequest | null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    let location: string | undefined;

    if (params.req) {
      ipAddress =
        params.req.headers.get("x-real-ip") ??
        params.req.headers.get("cf-connecting-ip") ??
        params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

      userAgent = params.req.headers.get("user-agent") ?? undefined;

      const country =
        params.req.headers.get("cf-ipcountry") ??
        params.req.headers.get("x-vercel-ip-country");
      const city = params.req.headers.get("cf-ipcity");
      if (country || city)
        location = [city, country].filter(Boolean).join(", ");
    }

=======
  meta?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(params: AuditParams) {
  try {
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        module: params.module,
        entityId: params.entityId,
        resourceId: params.resourceId,
<<<<<<< HEAD
        resourceType: params.resourceType,
        beforeData: params.beforeData,
        afterData: params.afterData,
        meta: params.meta ? JSON.stringify(params.meta) : null,
        ipAddress,
        userAgent,
        location,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to record:", params.action, err);
  }
}

import type { NextRequest as FleetNextRequest } from "next/server";

export interface AuditPayload {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  details?: Record<string, any> | null;
  status?: "success" | "failed" | "warning";
  sessionId?: string | null;
  location?: string | null;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  ipAddress: string;
  userAgent: string;
}

export function parseDeviceInfo(request: FleetNextRequest): DeviceInfo {
  const ua = request.headers.get("user-agent") ?? "";
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  const trueIp = request.headers.get("true-client-ip");
  const rawIp =
    cfIp ?? trueIp ?? forwarded?.split(",")[0].trim() ?? realIp ?? null;
  const ipAddress =
    rawIp && rawIp !== "::1" && rawIp !== "127.0.0.1" ? rawIp : "localhost";

  let browser = "Unknown Browser";
  if (ua.includes("Edg/"))
    browser = `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] ?? ""}`;
  else if (ua.includes("Chrome/"))
    browser = `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ""}`;
  else if (ua.includes("Firefox/"))
    browser = `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ""}`;
  else if (ua.includes("Safari/") && !ua.includes("Chrome"))
    browser = `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ""}`;
  else if (ua.includes("MSIE") || ua.includes("Trident/"))
    browser = "Internet Explorer";

  let os = "Unknown OS";
  if (ua.includes("Windows NT 10.0")) os = "Windows 11/10";
  else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
  else if (ua.includes("Windows NT 6.2")) os = "Windows 8";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Macintosh"))
    os = `macOS ${ua.match(/Mac OS X ([\d_.]+)/)?.[1]?.replace(/_/g, ".") ?? ""}`;
  else if (ua.includes("Android"))
    os = `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}`;
  else if (ua.includes("iPhone OS"))
    os = `iOS ${ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? ""}`;
  else if (ua.includes("iPad"))
    os = `iPadOS ${ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? ""}`;
  else if (ua.includes("Linux")) os = "Linux";

  let device = "desktop";
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone"))
    device = "mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) device = "tablet";

  return {
    browser: browser.trim(),
    os: os.trim(),
    device,
    ipAddress,
    userAgent: ua,
  };
}

export async function resolveLocation(ip: string): Promise<string | null> {
  if (
    !ip ||
    ip === "unknown" ||
    ip === "localhost" ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.")
  ) {
    return "Local Network";
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=city,country,status`,
      {
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === "success") {
      return (
        `${data.city ?? ""}, ${data.country ?? ""}`
          .replace(/^, |, $/, "")
          .trim() || null
      );
    }
  } catch {
  }
  return null;
}

export function logFleetAudit(
  request: FleetNextRequest | null,
  payload: AuditPayload,
): void {
  const deviceInfo: Partial<DeviceInfo> = request
    ? parseDeviceInfo(request)
    : {};

  (async () => {
    let location = payload.location ?? null;
    if (
      !location &&
      deviceInfo.ipAddress &&
      deviceInfo.ipAddress !== "localhost"
    ) {
      location = await resolveLocation(deviceInfo.ipAddress).catch(() => null);
    }

    await prisma.auditLog
      .create({
        data: {
          userId: payload.userId ?? null,
          userEmail: payload.userEmail ?? null,
          userName: payload.userName ?? null,
          userRole: payload.userRole ?? null,
          action: payload.action,
          module: "fleet",
          resourceId: payload.resourceId ?? null,
          resourceType: payload.resource ?? null,
          status: payload.status ?? "success",
          sessionId: payload.sessionId ?? null,
          ipAddress: deviceInfo.ipAddress ?? null,
          userAgent: deviceInfo.userAgent ?? null,
          browser: deviceInfo.browser ?? null,
          os: deviceInfo.os ?? null,
          device: deviceInfo.device ?? null,
          location: location ?? null,
        },
      })
      .catch((err) => {
        console.error("[AuditLog] Write failed:", err);
      });
  })();
}

export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  VIEW: "VIEW",
  EXPORT: "EXPORT",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  SUBMIT: "SUBMIT",
  COMPLETE: "COMPLETE",
  CANCEL: "CANCEL",
  INVITE_USER: "INVITE_USER",
  DEACTIVATE_USER: "DEACTIVATE_USER",
  REACTIVATE_USER: "REACTIVATE_USER",
  GENERATE_LICENSE: "GENERATE_LICENSE",
  ACTIVATE_LICENSE: "ACTIVATE_LICENSE",
  REVOKE_LICENSE: "REVOKE_LICENSE",
  RECALL: "RECALL",
  SESSION_START: "SESSION_START",
  SESSION_END: "SESSION_END",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
=======
        meta: params.meta ? JSON.stringify(params.meta) : null,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    // Non-blocking — log to console but don't throw
    console.error("[AuditLog] Failed to record audit:", err);
  }
}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
