import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLandingPage } from "@/lib/rbac";
import { isSafeReturnPath } from "@/lib/session-config";
import TwoFactorVerify from "@/components/auth/TwoFactorVerify";

export default async function TwoFactorVerifyPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) {
    redirect("/login");
  }

  const mfaStatus = (session.user as any).mfaStatus;
  if (mfaStatus === "enrollment_required") redirect("/2fa/setup");
  if (mfaStatus === "verified") {
    const requested = searchParams?.callbackUrl;
    redirect(isSafeReturnPath(requested) ? requested : await getUserLandingPage());
  }

  const callbackUrl =
    isSafeReturnPath(searchParams?.callbackUrl) ? searchParams.callbackUrl! : undefined;

  return (
    <TwoFactorVerify
      userName={(session.user as any).name ?? ""}
      callbackUrl={callbackUrl}
    />
  );
}
