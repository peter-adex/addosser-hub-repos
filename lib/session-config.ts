export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired due to inactivity. Please log in again.";

export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false;
  return true;
}

const AUTH_PATH_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/invite"];

export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!isSafeInternalPath(path)) return false;
  return !AUTH_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}
