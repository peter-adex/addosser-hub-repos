import { Metadata } from "next";
import SignOutButton from "@/components/auth/SignOutButton";

export const metadata: Metadata = { title: "No Access" };

export default function NoAccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-8">
        <div className="text-6xl mb-6">🚫</div>
        <h1 className="text-3xl font-extrabold text-foreground mb-3">No Access Assigned</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Your account does not currently have access to any part of this application.
          Please contact your administrator to have permissions assigned to your role.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
