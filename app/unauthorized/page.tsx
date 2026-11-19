import Link from "next/link";
import { Metadata } from "next";
<<<<<<< HEAD
import { getUserLandingPage } from "@/lib/rbac";

export const metadata: Metadata = { title: "Access Denied" };

export default async function UnauthorizedPage() {
  const landingPage = await getUserLandingPage();

=======

export const metadata: Metadata = { title: "Access Denied" };

export default function UnauthorizedPage() {
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-8">
        <div className="text-6xl mb-6">🔒</div>
<<<<<<< HEAD
        <h1 className="text-3xl font-extrabold text-foreground mb-3">Access Restricted</h1>
        <p className="text-muted-foreground text-sm mb-8">
          You do not have permission to access this page. Please contact your administrator if you believe you should have access.
        </p>
        <Link
          href={landingPage}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          ← Go to My Dashboard
=======
        <h1 className="text-3xl font-extrabold text-foreground mb-3">Access Denied</h1>
        <p className="text-muted-foreground text-sm mb-8">
          You don&apos;t have permission to access this page. Contact your administrator if you believe this is an error.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          ← Back to Dashboard
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        </Link>
      </div>
    </div>
  );
}
