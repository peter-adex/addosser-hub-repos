"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1523] to-[#1B2A8A] p-8">
      <div className="w-full max-w-md bg-white dark:bg-[#1A2236] rounded-2xl shadow-2xl p-10">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt="Addosser" width={48} height={48} className="rounded-xl object-contain" />
          <div>
            <div className="font-extrabold text-[#1B2A8A] text-lg">ADDOSSER</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Enterprise Hub</div>
          </div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly. The link expires in 1 hour.
            </p>
            <Link href="/login" className="text-sm font-semibold text-[#1B2A8A] hover:underline">← Back to sign in</Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">Forgot password?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Enter your work email and we&apos;ll send a reset link.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Work Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@addosser.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#1E2D45] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-60"
                style={{ background: "#FFB800", color: "#1B2A8A" }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
              Remembered your password?{" "}
              <Link href="/login" className="font-semibold text-[#1B2A8A] hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
