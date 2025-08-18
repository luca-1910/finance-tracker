"use client";

import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

// Create a Supabase browser client (reads your NEXT_PUBLIC_* env vars)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Shape of the profile row we edit on this page
type Profile = {
  id: string;
  full_name: string | null;
  currency: string | null;   // 3‑letter code, e.g., AUD
  week_start: number | null; // 1 = Monday … 7 = Sunday
  // avatar_url?: string | null; // reserved for later
};

export default function ProfilePage() {
  // ─────────────────────────────────────────────────────────────
  // Auth/session tracking
  // ─────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────
  // Profile editing state
  // ─────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);

  // Feedback flags/messages for Profile save
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Change‑password section state
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // On mount: get session, ensure profile row exists, fetch profile
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data.session ?? null;
      setSession(sess);

      // If not logged in, push to /login
      if (!sess?.user?.id) {
        setLoading(false);
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }

      // Ensure a profile row exists for this user (idempotent)
      await supabase.from("profiles").upsert({ id: sess.user.id });

      // Fetch current profile values
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, full_name, currency, week_start")
        .eq("id", sess.user.id)
        .single();

      if (!error && prof) {
        setProfile(prof as Profile);
      }

      setLoading(false);
    })();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────

  // Save profile changes to DB
  const onSaveProfile = async () => {
    if (!profile || !session?.user?.id) return;

    // quick client‑side validation
    const name = (profile.full_name ?? "").trim();
    if (!name) {
      setSaveErr("Please enter your name.");
      setSaveMsg(null);
      return;
    }
    const cur = (profile.currency ?? "AUD").toUpperCase();
    if (cur.length !== 3) {
      setSaveErr("Currency must be a 3‑letter ISO code (e.g., AUD).");
      setSaveMsg(null);
      return;
    }
    const week = profile.week_start ?? 1;
    if (week < 1 || week > 7) {
      setSaveErr("Week start must be between 1 (Mon) and 7 (Sun).");
      setSaveMsg(null);
      return;
    }

    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name,
        currency: cur,
        week_start: week,
      })
      .eq("id", session.user.id);

    setSaving(false);

    if (error) {
      setSaveErr(error.message);
      setSaveMsg(null);
    } else {
      setSaveErr(null);
      setSaveMsg("Saved!");
    }
  };

  // Change the user password (user is already authenticated)
  const onChangePassword = async () => {
    setPwdErr(null);
    setPwdMsg(null);

    if (newPwd.length < 8) {
      setPwdErr("Password must be at least 8 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdErr("Passwords do not match.");
      return;
    }

    setPwdBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPwdMsg("Password updated.");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e: unknown) {
      if (e instanceof Error) setPwdErr(e.message);
      else setPwdErr("Could not update password.");
    } finally {
      setPwdBusy(false);
    }
  };

  // Sign out and go to /login
  const onSignOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--muted)]">
        Unable to load profile.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Your Profile</h1>
        <div className="flex gap-2">
          <a
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] hover:bg-[color:#464a4d] text-sm"
          >
            Dashboard
          </a>
          <button
            onClick={onSignOut}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] hover:bg-[color:#464a4d] text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <h2 className="font-semibold">Basic info</h2>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {/* Full name */}
          <div>
            <label className="block text-sm mb-1 text-[var(--muted)]">Full name</label>
            <input
              value={profile.full_name ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, full_name: e.target.value })
              }
              placeholder="e.g., Luca"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm mb-1 text-[var(--muted)]">Currency (ISO)</label>
            <input
              value={(profile.currency ?? "AUD").toUpperCase()}
              onChange={(e) =>
                setProfile({ ...profile, currency: e.target.value.toUpperCase() })
              }
              maxLength={3}
              placeholder="AUD"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
            />
          </div>

          {/* Week start */}
          <div>
            <label className="block text-sm mb-1 text-[var(--muted)]">
              Week starts (1 = Mon … 7 = Sun)
            </label>
            <input
              type="number"
              min={1}
              max={7}
              value={profile.week_start ?? 1}
              onChange={(e) =>
                setProfile({ ...profile, week_start: Number(e.target.value) })
              }
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
            />
          </div>
        </div>

        {/* Save profile */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onSaveProfile}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saveMsg && <span className="self-center text-emerald-400">{saveMsg}</span>}
          {saveErr && <span className="self-center text-rose-400">{saveErr}</span>}
        </div>
      </div>

      {/* Change password card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm mt-5">
        <h2 className="font-semibold">Security</h2>
        <p className="text-sm text-[var(--muted)]">Change your password.</p>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm mb-1 text-[var(--muted)]">New password</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-[var(--muted)]">Confirm password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onChangePassword}
            disabled={pwdBusy}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
          >
            {pwdBusy ? "Updating…" : "Update password"}
          </button>
          {pwdMsg && <span className="self-center text-emerald-400">{pwdMsg}</span>}
          {pwdErr && <span className="self-center text-rose-400">{pwdErr}</span>}
        </div>
      </div>
    </div>
  );
}
