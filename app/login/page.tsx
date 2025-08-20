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

export default function LoginPage() {
  // Read ?next= from URL (middleware adds this when it bounces users)
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next") || null;

  // Keep signed-in users away from /login
  const [session, setSession] = useState<Session | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");

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

  // Redirect if already authenticated
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

      if (mode === "password") {
        if (!password) return setErr("Please enter your password.");
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // success: auth state listener will redirect
      } else {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const callbackUrl = nextParam
          ? `${origin}${AUTH_CALLBACK}?next=${encodeURIComponent(nextParam)}`
          : `${origin}${AUTH_CALLBACK}`;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: callbackUrl,
          },
        });
        if (error) throw error;
        setMsg(
          "Magic link sent! Check your email and open it in this browser."
        );
      }
    } catch (e: unknown) {
      setErr(normalizeError(getErrorMessage(e)));
    } finally {
      setSending(false);
    }
  };

  const onResetPassword = async () => {
    setErr(null);
    setMsg(null);
    if (!email) return setErr("Enter the account email first.");

    try {
      setSending(true);
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const callbackUrl = nextParam
        ? `${origin}${AUTH_CALLBACK}?next=${encodeURIComponent(nextParam)}`
        : `${origin}${AUTH_CALLBACK}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:callbackUrl,
      });
      if (error) throw error;
      setMsg("If an account exists, we sent a reset link to your email.");
    } catch (e: unknown) {
      setErr(normalizeError(getErrorMessage(e)));
    } finally {
      setSending(false);
    }
  };

  // const oauth = async (provider: "google" | "apple") => {
  //   setErr(null);
  //   setMsg(null);
  //   try {
  //     setSending(true);
  //     const { error } = await supabase.auth.signInWithOAuth({
  //       provider,
  //       options: {
  //         redirectTo:
  //           typeof window !== "undefined"
  //             ? `${window.location.origin}${AUTH_CALLBACK}`
  //             : undefined,
  //       },
  //     });
  //     if (error) throw error;
  //     // Redirect happens automatically on success
  //   } catch (e: unknown) {
  //     setErr(normalizeError(getErrorMessage(e)));
  //   } finally {
  //     setSending(false);
  //   }
  // };

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

        {/* Form */}
        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="block text-sm mb-1" htmlFor="email">
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
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
            required
          />

          {mode === "password" && (
            <>
              <label className="block text-sm mt-3 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={sending}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
                required
              />
            </>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-2 w-full h-10 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
          >
            {sending
              ? "Please wait…"
              : mode === "password"
              ? "Sign in"
              : "Send login link"}
          </button>
        </form>

        {/* Secondary actions */}
        {mode === "password" ? (
          <div className="mt-3 flex justify-between text-xs text-[var(--muted)]">
            <button
              onClick={onResetPassword}
              disabled={sending}
              className="underline"
            >
              Forgot password?
            </button>
            <a className="underline" href="/signup">
              Create an account
            </a>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">
            New here?{" "}
            <a className="underline text-[var(--accent)]" href="/signup">
              Create an account
            </a>
            .
          </p>
        )}

        {/* OAuth (optional) */}
        <div className="mt-4 grid gap-2">
          {/* Uncomment when ready */}
          {/* <button
            disabled={sending}
            onClick={() => oauth("google")}
            className="h-10 rounded-xl border bg-[var(--panel)] hover:bg-[color:#464a4d] transition disabled:opacity-60"
          >
            Continue with Google
          </button> */}
        </div>

        {/* Status / error messages */}
        {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

        {mode === "magic" && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Tip: keep this tab open and click the link within a few minutes.
          </p>
        )}
      </div>
    </div>
  );
}

function normalizeError(m: string) {
  if (/Email not confirmed/i.test(m))
    return "Please verify your email before signing in.";
  if (/Invalid login credentials/i.test(m))
    return "Email or password is incorrect.";
  if (/Token has expired|expired/i.test(m))
    return "Your link expired. Request a new one.";
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
