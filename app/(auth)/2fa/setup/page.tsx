import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLandingPage } from "@/lib/rbac";
import { isSafeReturnPath } from "@/lib/session-config";
import TwoFactorSetup from "@/components/auth/TwoFactorSetup";

export default async function TwoFactorSetupPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) {
    redirect("/login");
  }

  const mfaStatus = (session.user as any).mfaStatus;
  if (mfaStatus === "verification_required") redirect("/2fa/verify");
  if (mfaStatus === "verified") {
    const requested = searchParams?.callbackUrl;
    redirect(isSafeReturnPath(requested) ? requested : await getUserLandingPage());
  }

  const callbackUrl =
    isSafeReturnPath(searchParams?.callbackUrl) ? searchParams.callbackUrl! : undefined;

  return (
    <TwoFactorSetup
      userName={(session.user as any).name ?? ""}
      callbackUrl={callbackUrl}
    />
  );
}
