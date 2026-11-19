import { headers } from "next/headers";

function isLikelyLocalOrLan(host: string): boolean {
  const hostname = host.split(":")[0];
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function firstAllowedOrigin(): string | null {
  const raw = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)[0];
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw.replace(/\/+$/, "");
  return `${isLikelyLocalOrLan(raw) ? "http" : "https"}://${raw}`;
}

export function getBaseUrl(): string {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ?? (isLikelyLocalOrLan(host) ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
  }
  return firstAllowedOrigin() ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
