import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { IDLE_TIMEOUT_MS, SESSION_COOKIE_NAMES, isSafeReturnPath } from "@/lib/session-config";
import { computeMfaStatusFromClaims } from "@/lib/mfa/status";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) return NextResponse.next();

  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/2fa")) {
    const mfaStatus = computeMfaStatusFromClaims({
      mfaEnabled: (token as any).mfaEnabled,
      mfaVerifiedAt: (token as any).mfaVerifiedAt,
      mfaIntervalDays: (token as any).mfaIntervalDays,
    });
    if (mfaStatus !== "verified") {
      const destination = mfaStatus === "enrollment_required" ? "/2fa/setup" : "/2fa/verify";
      const url = new URL(destination, req.url);
      const attemptedPath = `${pathname}${req.nextUrl.search}`;
      if (isSafeReturnPath(attemptedPath)) {
        url.searchParams.set("callbackUrl", attemptedPath);
      }
      return NextResponse.redirect(url);
    }
  }

  const lastActivityAt = (token as any).lastActivityAt as number | undefined;
  if (!lastActivityAt) return NextResponse.next();

  const idleFor = Date.now() - lastActivityAt;
  if (idleFor <= IDLE_TIMEOUT_MS) return NextResponse.next();

  const idleAttemptedPath = `${pathname}${req.nextUrl.search}`;

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("reason", "idle");
  if (isSafeReturnPath(idleAttemptedPath)) {
    loginUrl.searchParams.set("callbackUrl", idleAttemptedPath);
  }

  const response = NextResponse.redirect(loginUrl);
  for (const cookieName of SESSION_COOKIE_NAMES) {
    response.cookies.delete(cookieName);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png|login|forgot-password|reset-password|invite|unauthorized|no-access).*)",
  ],
};
