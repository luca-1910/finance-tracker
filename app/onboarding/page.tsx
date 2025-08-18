"use client";

import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

// Create a Supabase browser client using public env vars
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Minimal shape of the profile row we edit here
// type Profile = {
//   id: string;
//   full_name: string | null;
//   currency: string | null; // e.g., "AUD"
//   week_start: number | null; // 1=Mon … 7=Sun
// };

export default function OnboardingPage() {
  // ── Track session: magic link should have created a session already
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fields we collect during onboarding (simple + unopinionated)
  const [fullName, setFullName] = useState("");
  const [currency, setCurrency] = useState("AUD");
  const [weekStart, setWeekStart] = useState(1);

  // ── Password the user chooses now (so they can log in without email next time)
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // ── UX flags/messages
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // When the page loads, read the session that OTP created.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
  }, []);

  // If the link expired or user isn't authenticated, reroute to /signup to retry
  if (!loading && !session) {
    if (typeof window !== "undefined") window.location.href = "/signup";
    return null;
  }

  // Handle the onboarding submit
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    // Simple client-side validation
    if (!fullName.trim()) {
      setErr("Please enter your name.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      // 1) Ensure a profile row exists (idempotent) and update it
      await supabase.from("profiles").upsert({
        id: session!.user.id,
        full_name: fullName.trim(),
        currency: currency.toUpperCase(),
        week_start: weekStart,
      });

      // 2) Set password for this newly authenticated user (OTP session allows update)
      const { error: pwdErr } = await supabase.auth.updateUser({ password });
      if (pwdErr) throw pwdErr;

      // 3) Go to the main app
      if (typeof window !== "undefined") window.location.href = "/dashboard";
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("Something went wrong.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] grid place-items-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Welcome! Let’s finish setup.</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tell us a few things and choose a password for next time.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          {/* Profile fields */}
          <div>
            <label className="block text-sm mb-1">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Currency (ISO)</label>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="AUD"
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Week starts (1=Mon…7=Sun)
              </label>
              <input
                type="number"
                min={1}
                max={7}
                value={weekStart}
                onChange={(e) => setWeekStart(Number(e.target.value))}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
              />
            </div>
          </div>

          {/* Password fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Confirm</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
              />
            </div>
          </div>

          {err && <p className="text-rose-400 text-sm">{err}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-1 px-4 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Finish setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
