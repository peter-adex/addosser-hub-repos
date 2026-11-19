"use client";

<<<<<<< HEAD
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

interface InvitationDetails {
  email: string;
  name: string;
  roleName: string;
  entity: { name: string; code: string };
  extraEntities: { name: string; code: string }[];
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();

  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(true);

=======
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

<<<<<<< HEAD
  useEffect(() => {
    fetch(`/api/users/invite/${token}`)
      .then(async (res) => {
        const text = await res.text();
        let data: any = {};
        if (text.trim()) {
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error(`Unexpected response from server (${res.status}). Please try again or contact your administrator.`);
          }
        }
        if (!res.ok) throw new Error(data.error ?? `Invalid invitation link (${res.status})`);
        setDetails(data);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoadingDetails(false));
  }, [token]);

=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/users/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
<<<<<<< HEAD
        body: JSON.stringify({ token, password }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Unexpected response from server (${res.status}). Please try again.`);
        }
      }
=======
        body: JSON.stringify({ token, name, password }),
      });
      const data = await res.json();
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push("/login?invited=1");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";

=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1523] to-[#1B2A8A] p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt="Addosser" width={52} height={52} className="rounded-xl" />
          <div>
            <div className="font-extrabold text-[#1B2A8A] text-lg">ADDOSSER</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Enterprise Hub</div>
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Accept Invitation</h2>
<<<<<<< HEAD
        <p className="text-sm text-gray-500 mb-6">Set a password to activate your account.</p>

        {loadingDetails && (
          <div className="py-10 text-center text-sm text-gray-500">Loading invitation…</div>
        )}

        {!loadingDetails && loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {loadError}
          </div>
        )}

        {!loadingDetails && details && (
          <>
            <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</div>
                <div className="text-sm font-bold text-gray-900">{details.name || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email</div>
                <div className="text-sm text-gray-700">{details.email}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</div>
                <div className="text-sm text-gray-700">{details.roleName}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Entity Access
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-xs font-bold bg-[#1B2A8A]/10 text-[#1B2A8A] border border-[#1B2A8A]/20 rounded-full px-2.5 py-0.5">
                    {details.entity.name} ({details.entity.code}) — Primary
                  </span>
                  {details.extraEntities.map((e) => (
                    <span
                      key={e.code}
                      className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5"
                    >
                      {e.name} ({e.code})
                    </span>
                  ))}
                </div>
                {details.extraEntities.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Your administrator has also given you access to the additional
                    {details.extraEntities.length > 1 ? " entities" : " entity"} shown above.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { label: "Password", value: password, onChange: setPassword, placeholder: "Min. 8 characters" },
                { label: "Confirm Password", value: confirm, onChange: setConfirm, placeholder: "Repeat password" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {f.label}
                  </label>
                  <input
                    type="password"
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    placeholder={f.placeholder}
                    required
                    className={inputCls}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60"
                style={{ background: "#FFB800", color: "#1B2A8A" }}
              >
                {loading ? "Setting up..." : "Create Account"}
              </button>
            </form>
          </>
        )}
=======
        <p className="text-sm text-gray-500 mb-8">Set up your account to get started.</p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {[
            { label: "Full Name", type: "text", value: name, onChange: setName, placeholder: "Adaeze Okonkwo" },
            { label: "Password", type: "password", value: password, onChange: setPassword, placeholder: "Min. 8 characters" },
            { label: "Confirm Password", type: "password", value: confirm, onChange: setConfirm, placeholder: "Repeat password" },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60"
            style={{ background: "#FFB800", color: "#1B2A8A" }}
          >
            {loading ? "Setting up..." : "Create Account"}
          </button>
        </form>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      </div>
    </div>
  );
}
