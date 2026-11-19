"use client";

import { useState, useRef } from "react";
import { Camera, Lock, User, Building, Shield, Calendar } from "lucide-react";

interface UserProfile {
  id:           string;
  name:         string;
  email:        string;
  avatar:       string | null;
  roleName:     string;
  entityName:   string;
  entityCode:   string;
  extraEntities: { id: string; name: string; code: string }[];
  pendingName:  string | null;
  pendingNameRequestedAt: string | null;
  createdAt:    string;
  lastLoginAt:  string | null;
}

interface Props { user: UserProfile; }

export default function ProfileForm({ user }: Props) {
  const [name, setName]           = useState(user.name);
  const [avatar, setAvatar]       = useState(user.avatar ?? "");
  const [avatarStorage, setAvatarStorage] = useState<{ provider: string | null; key: string | null }>({ provider: null, key: null });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      setUploading(true);
      try {
        const res  = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: reader.result as string, folder: "avatars" }),
        });
        const data = await res.json();
        if (data.success) {
          setAvatar(data.data.url);
          setAvatarStorage({ provider: data.data.storageProvider ?? null, key: data.data.storageKey ?? null });
        }
      } catch { }
      finally { setUploading(false); }
    };
  };

  const saveProfile = async () => {
    setSaving(true);
    setProfileMsg("");
    try {
      const res  = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          avatar: avatar || null,
          ...(avatarStorage.key ? { avatarStorageProvider: avatarStorage.provider, avatarStorageKey: avatarStorage.key } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg(`❌ ${data.error}`);
      } else if (data.nameChangeRequested) {
        setProfileMsg("✅ Photo saved. Your name change has been submitted for admin approval.");
      } else {
        setProfileMsg("✅ Profile updated successfully");
      }
    } catch { setProfileMsg("❌ Failed to save"); }
    finally { setSaving(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    if (newPw !== confirmPw) { setPwMsg("❌ Passwords do not match"); return; }
    if (newPw.length < 8)    { setPwMsg("❌ Password must be at least 8 characters"); return; }

    setPwSaving(true);
    try {
      const res  = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) { setPwMsg("✅ Password changed successfully"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
      else         { setPwMsg(`❌ ${data.error}`); }
    } catch { setPwMsg("❌ Failed to change password"); }
    finally { setPwSaving(false); }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-5">

      <div className="bg-card border border-border rounded-2xl p-6 flex items-start gap-5">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FFB800] flex items-center justify-center">
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#1B2A8A] font-extrabold text-2xl">{name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center hover:bg-[#E0A300] transition-colors shadow-md"
            title="Change photo"
          >
            {uploading ? <span className="animate-spin text-xs">⟳</span> : <Camera size={12} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-foreground text-lg">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1 text-xs bg-[#1B2A8A]/10 text-[#1B2A8A] dark:text-blue-300 border border-[#1B2A8A]/20 rounded-full px-2.5 py-0.5 font-bold">
              <Shield size={10} /> {user.roleName}
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
              <Building size={10} /> {user.entityCode}
            </span>
          </div>
          {user.extraEntities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {user.extraEntities.map((e) => (
                <span key={e.id} className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5">
                  {e.code}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-2">
            {user.lastLoginAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={10} /> Last login: {new Date(user.lastLoginAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar size={10} /> Joined: {new Date(user.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={16} className="text-muted-foreground" />
          <h2 className="font-bold text-foreground">Personal Information</h2>
        </div>

        {profileMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${profileMsg.startsWith("✅") ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"}`}>
            {profileMsg}
          </div>
        )}

        {user.pendingName && (
          <div className="mb-4 p-3 rounded-xl text-sm font-medium border bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
            ⏳ Your request to change your name to <strong>"{user.pendingName}"</strong> is
            awaiting admin approval
            {user.pendingNameRequestedAt && (
              <> (requested {new Date(user.pendingNameRequestedAt).toLocaleDateString("en-NG", { dateStyle: "medium" })})</>
            )}
            . Your name stays as <strong>{user.name}</strong> until then.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls}>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Your full name" />
            {user.pendingName && name !== user.name && name !== user.pendingName && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Submitting this will replace your currently pending request above.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" value={user.email} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed. Contact your administrator.</p>
          </div>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="mt-5 px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition-all"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={16} className="text-muted-foreground" />
          <h2 className="font-bold text-foreground">Change Password</h2>
        </div>

        {pwMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${pwMsg.startsWith("✅") ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"}`}>
            {pwMsg}
          </div>
        )}

        <form onSubmit={changePassword} className="space-y-4">
          {[
            { label: "Current Password",  value: currentPw, set: setCurrentPw },
            { label: "New Password",       value: newPw,    set: setNewPw },
            { label: "Confirm New Password", value: confirmPw, set: setConfirmPw },
          ].map((f) => (
            <div key={f.label}>
              <label className={labelCls}>{f.label}</label>
              <input type="password" value={f.value} onChange={(e) => f.set(e.target.value)} required className={inputCls} placeholder="••••••••" />
            </div>
          ))}
          <button
            type="submit"
            disabled={pwSaving}
            className="px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition-all border border-border bg-card hover:bg-accent text-foreground"
          >
            {pwSaving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
