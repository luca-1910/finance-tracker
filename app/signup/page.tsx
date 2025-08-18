"use client";

import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

// Create a Supabase browser client using public env vars
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignupPage() {
  // ── UI state for sign‑up (email-only, passwordless magic link)
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── If already signed in, redirect away (no need to see signup)
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return null;
  }

  // ── Send magic link configured to redirect to /onboarding
  const onSignUp = async () => {
    setErr(null);
    setMsg(null);

    // Basic guard; keep simple for now
    if (!email.includes("@")) {
      setErr("Enter a valid email.");
      return;
    }

    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Ensure new accounts are created if they don’t exist yet
        shouldCreateUser: true,
        // After clicking the email link, user is sent to /onboarding
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/onboarding`
            : undefined,
      },
    });
    setSending(false);

    if (error) setErr(error.message);
    else
      setMsg(
        "We sent you a sign-up link. Open it in this browser to continue."
      );
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">Create your account</h1>
        <p className="text-sm text-[var(--muted)] mb-4">
          We’ll email you a magic link. You’ll finish setup on the next page.
        </p>

        {/* Email input (kept minimal for frictionless onboarding) */}
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
        />

        {/* Send link */}
        <button
          onClick={onSignUp}
          disabled={sending}
          className="mt-4 w-full px-4 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send sign-up link"}
        </button>

        {/* Status / error messages */}
        {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

        {/* Shortcut to login if they already have an account */}
        <p className="mt-6 text-xs text-[var(--muted)]">
          Already have an account?{" "}
          <a className="text-[var(--accent)] underline" href="/login">
            Log in
          </a>
          .
        </p>
      </div>
    </div>
  );
}
