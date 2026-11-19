"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { isSafeReturnPath } from "@/lib/session-config";

type Stage = "loading" | "confirm" | "recovery" | "error";

export default function TwoFactorSetup({
  userName,
  callbackUrl,
}: {
  userName: string;
  callbackUrl?: string;
}) {
  const { update } = useSession();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/mfa/setup/init", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not start enrollment.");
          setStage("error");
          return;
        }
        setQrCodeDataUrl(data.qrCodeDataUrl);
        setManualKey(data.manualKey);
        setStage("confirm");
      } catch {
        setError("Network error while starting enrollment.");
        setStage("error");
      }
    })();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/mfa/setup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code. Please try again.");
        setSubmitting(false);
        return;
      }
      setRecoveryCodes(data.recoveryCodes);
      setStage("recovery");
    } catch {
      setError("Network error while verifying the code.");
    } finally {
      setSubmitting(false);
    }
  };

  const finishAndContinue = async () => {
    await update({ mfaSync: true });
    router.push(isSafeReturnPath(callbackUrl) ? callbackUrl! : "/dashboard");
    router.refresh();
  };

  const cardCls =
    "w-full max-w-md bg-white dark:bg-[#1A2236] rounded-2xl shadow-2xl p-10";
  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#1E2D45] text-gray-900 dark:text-white text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-transparent";
  const buttonCls =
    "w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-60";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: "linear-gradient(135deg, #0F1523 0%, #1B2A8A 100%)" }}
    >
      <div className={cardCls}>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">
          Secure your account
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Hi {userName || "there"} — two-factor authentication is required before you can
          continue.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {stage === "loading" && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Preparing your setup…</p>
        )}

        {stage === "confirm" && (
          <>
            <ol className="text-sm text-gray-600 dark:text-gray-300 list-decimal list-inside space-y-2 mb-6">
              <li>
                Open Microsoft Authenticator, Google Authenticator, Authy, or any other
                TOTP-compatible app.
              </li>
              <li>Scan the QR code below, or enter the manual key.</li>
              <li>Enter the 6-digit code it generates.</li>
            </ol>

            {qrCodeDataUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={qrCodeDataUrl}
                  alt="Scan this QR code with your authenticator app"
                  width={200}
                  height={200}
                  className="rounded-xl border border-gray-200 dark:border-gray-700"
                />
              </div>
            )}

            <div className="mb-6 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                Can&apos;t scan? Enter this key manually
              </p>
              <code className="text-sm font-mono break-all text-gray-800 dark:text-gray-200">
                {manualKey}
              </code>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                className={inputCls}
              />
              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className={buttonCls}
                style={{ background: "#FFB800", color: "#1B2A8A" }}
              >
                {submitting ? "Verifying…" : "Verify & Enable"}
              </button>
            </form>
          </>
        )}

        {stage === "recovery" && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Save these one-time recovery codes somewhere safe. Each can be used once if you
              lose access to your authenticator app. They won&apos;t be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-6 p-4 rounded-xl bg-gray-50 dark:bg-[#1E2D45] font-mono text-sm">
              {recoveryCodes.map((c) => (
                <div key={c} className="text-gray-800 dark:text-gray-200">
                  {c}
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I&apos;ve saved these recovery codes.
            </label>
            <button
              onClick={finishAndContinue}
              disabled={!acknowledged}
              className={buttonCls}
              style={{ background: "#FFB800", color: "#1B2A8A" }}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
