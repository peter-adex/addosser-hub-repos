import { redirect } from "next/navigation";
<<<<<<< HEAD
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleNavigation, hasPageAccess } from "@/lib/rbac";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import IdleSessionTracker from "@/components/auth/IdleSessionTracker";
import RouteProgress from "@/components/layout/RouteProgress";
=======
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

<<<<<<< HEAD
  const mfaStatus = (session.user as any).mfaStatus;
  if (mfaStatus === "enrollment_required") redirect("/2fa/setup");
  if (mfaStatus === "verification_required") redirect("/2fa/verify");

  const [modules, hasMasterDashboard] = await Promise.all([
    getAccessibleNavigation(),
    hasPageAccess("dashboard", "overview", "view"),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <IdleSessionTracker />
      <Sidebar modules={modules} hasMasterDashboard={hasMasterDashboard} />
=======
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-thin animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
