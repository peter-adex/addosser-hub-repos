"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => {
        signOut({ redirect: false }).finally(() => {
          window.location.href = "/login";
        });
      }}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
      style={{ background: "#FFB800", color: "#1B2A8A" }}
    >
      Sign Out
    </button>
  );
}
