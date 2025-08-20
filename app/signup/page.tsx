"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, type Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const REDIRECT_AFTER_AUTH = "/dashboard";
const AUTH_CALLBACK = "/auth/callback";

export default function SignUpPage() {
  // Read ?next= (set by middleware when bouncing from a protected route)
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next") || null;

  const [session, setSession] = useState<Session | null>(null);

  // mode + form state
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => unsub();
  }, []);

  // Already signed in? bounce to dashboard
  useEffect(() => {
    if (session && typeof window !== "undefined") {
      window.location.replace(nextParam || REDIRECT_AFTER_AUTH);
    }
  }, [session, nextParam]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!email) return setErr("Please enter your email.");

    try {
      setSending(true);

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const callbackUrl = nextParam
        ? `${origin}${AUTH_CALLBACK}?next=${encodeURIComponent(nextParam)}`
        : `${origin}${AUTH_CALLBACK}`;

      if (mode === "password") {
        if (!pw) return setErr("Please enter a password.");
        if (pw.length < 8)
          return setErr("Password must be at least 8 characters.");
        if (pw !== pw2) return setErr("Passwords do not match.");

        // Password sign-up (email confirmation enforced in Supabase settings)
        const { error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: {
            emailRedirectTo: callbackUrl,
            data: { full_name: fullName || null },
          },
        });
        if (error) throw error;
        setMsg("Check your email to confirm your account. Then sign in.");
      } else {
        // Magic link sign-up (passwordless)
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: callbackUrl,
            data: { full_name: fullName || null },
          },
        });
        if (error) throw error;
        setMsg("Magic link sent! Open it in this browser to finish sign-up.");
      }
    } catch (e: unknown) {
      setErr(normalizeError(getErrorMessage(e)));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-[var(--muted)] mb-4">
          Choose password or magic link. You’ll confirm your email if required.
        </p>

        {/* Mode switch */}
        <div className="mb-4 inline-flex rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
          <button
            type="button"
            disabled={sending}
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
            type="button"
            disabled={sending}
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

        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="text-sm" htmlFor="name">
            Full name (optional)
          </label>
          <input
            id="name"
            type="text"
            placeholder="e.g., Luca T."
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={sending}
            className="h-10 rounded-lg px-3 border border-[var(--border)] bg-[var(--panel)]"
          />

          <label className="text-sm mt-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            required
            className="h-10 rounded-lg px-3 border border-[var(--border)] bg-[var(--panel)]"
          />

          {mode === "password" && (
            <>
              <label className="text-sm mt-2" htmlFor="pw">
                Password
              </label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                disabled={sending}
                required
                className="h-10 rounded-lg px-3 border border-[var(--border)] bg-[var(--panel)]"
              />
              <label className="text-sm mt-2" htmlFor="pw2">
                Confirm password
              </label>
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                disabled={sending}
                required
                className="h-10 rounded-lg px-3 border border-[var(--border)] bg-[var(--panel)]"
              />
            </>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-3 h-10 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
          >
            {sending
              ? mode === "password"
                ? "Creating account…"
                : "Sending link…"
              : mode === "password"
              ? "Create account"
              : "Send sign-up link"}
          </button>
        </form>

        <p className="mt-3 text-xs text-[var(--muted)]">
          Already have an account?{" "}
          <a className="underline" href="/login">
            Sign in
          </a>
          .
        </p>

        {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
      </div>
    </div>
  );
}

/* ───────── helpers ───────── */

function normalizeError(m: string) {
  if (/User already registered/i.test(m))
    return "This email is already registered. Try signing in.";
  if (/Email rate limit/i.test(m))
    return "Too many attempts. Please try again shortly.";
  return m;
}

function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : JSON.stringify(m);
  }
  return "Unexpected error. Please try again.";
}
