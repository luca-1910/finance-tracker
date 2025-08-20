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

  const [email, setEmail] = useState("");
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

  // Already signed in? bounce (callback will have taken them to onboarding)
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
      // Always mark this flow explicitly as "signup"
      const callbackUrl = new URL(`${origin}${AUTH_CALLBACK}`);
      if (nextParam) callbackUrl.searchParams.set("next", nextParam);
      callbackUrl.searchParams.set("flow", "signup");

      // Magic link sign-up (passwordless, user creates password in onboarding)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callbackUrl.toString(),
        },
      });
      if (error) throw error;

      setMsg("Magic link sent! Open it on this device to continue.");
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
          We’ll email you a secure sign‑in link. You’ll finish setup on the next
          screen.
        </p>

        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="text-sm" htmlFor="email">
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

          <button
            type="submit"
            disabled={sending}
            className="mt-3 h-10 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
          >
            {sending ? "Sending link…" : "Send sign‑up link"}
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
