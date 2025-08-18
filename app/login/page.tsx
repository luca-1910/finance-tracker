"use client";

import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  // ── Keep signed-in users away from /login
  const [session, setSession] = useState<Session | null>(null);

    // ── Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Toggle between "password" and "magic link" modes
  const [mode, setMode] = useState<"password" | "magic">("password");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return null;
  }

  // After hooks, you can conditionally redirect/render
  if (session) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return null;
  }


  // ── Email + Password sign in
  const onSignInWithPassword = async () => {
    setErr(null); setMsg(null);
    if (!email || !password) { setErr("Enter email and password."); return; }

    setSending(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSending(false);

    if (error) setErr(error.message);
    else if (typeof window !== "undefined") window.location.href = "/dashboard";
  };

  // ── Magic-link sign in (fallback)
  const onSignInMagic = async () => {
    setErr(null); setMsg(null);
    if (!email.includes("@")) { setErr("Enter a valid email."); return; }

    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/dashboard`
            : undefined,
      },
    });
    setSending(false);

    if (error) setErr(error.message);
    else setMsg("Check your inbox for a magic link and open it in this browser.");
  };

  // ── Optional: send password reset email
  const onResetPassword = async () => {
    setErr(null); setMsg(null);
    if (!email.includes("@")) { setErr("Enter the account email first."); return; }

    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Create /reset if you want a custom reset page; otherwise use onboarding
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/onboarding`
          : undefined,
    });
    setSending(false);

    if (error) setErr(error.message);
    else setMsg("If an account exists, we sent a reset link to your email.");
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-[var(--muted)] mb-4">
          Use password (recommended) or a magic link.
        </p>

        {/* Mode switch */}
        <div className="mb-4 inline-flex rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
          <button
            onClick={() => setMode("password")}
            className={`px-3 py-1.5 text-sm transition ${
              mode === "password"
                ? "bg-[var(--accent)] text-black"
                : "bg-transparent text-[var(--muted)] hover:bg-[color:#464a4d]"
            }`}
          >
            Password
          </button>
          <button
            onClick={() => setMode("magic")}
            className={`px-3 py-1.5 text-sm transition ${
              mode === "magic"
                ? "bg-[var(--accent)] text-black"
                : "bg-transparent text-[var(--muted)] hover:bg-[color:#464a4d]"
            }`}
          >
            Magic link
          </button>
        </div>

        {/* Email field (shared) */}
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
        />

        {/* Password field (only in password mode) */}
        {mode === "password" && (
          <>
            <label className="block text-sm mt-3 mb-1">Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
            />
          </>
        )}

        {/* Primary action */}
        <button
          onClick={mode === "password" ? onSignInWithPassword : onSignInMagic}
          disabled={sending}
          className="mt-4 w-full px-4 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
        >
          {sending ? "Please wait…" : mode === "password" ? "Sign in" : "Send login link"}
        </button>

        {/* Secondary actions */}
        {mode === "password" ? (
          <div className="mt-3 flex justify-between text-xs text-[var(--muted)]">
            <button onClick={onResetPassword} className="underline">
              Forgot password?
            </button>
            <a className="underline" href="/signup">
              Create an account
            </a>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">
            New here? <a className="underline text-[var(--accent)]" href="/signup">Create an account</a>.
          </p>
        )}

        {/* Status / error messages */}
        {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

        {/* Tip */}
        {mode === "magic" && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Tip: keep this tab open and click the link within a few minutes.
          </p>
        )}
      </div>
    </div>
  );
}
