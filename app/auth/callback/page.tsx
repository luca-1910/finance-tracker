"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Keep this consistent with your login page
const REDIRECT_AFTER_AUTH = "/dashboard";
const ONBOARDING = "/onboarding";

export default function AuthCallbackPage() {
  const [stage, setStage] = useState<"loading" | "recovery" | "ready">("loading");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // For recovery (password reset)
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Parse current URL bits (query + hash) on the client
  const parts = useMemo(() => {
    if (typeof window === "undefined")
      return {
        query: new URLSearchParams(),
        hash: new URLSearchParams(),
        next: null as string | null,
        flow: null as string | null,
      };
    const url = new URL(window.location.href);
    const query = url.searchParams;
    // Supabase sometimes returns parameters in the hash fragment (#access_token=...), parse it as querystring
    const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    const next = query.get("next");
    const flow = (query.get("flow") || "").toLowerCase();
    return { query, hash, next, flow };
  }, []);

  // Generic redirect helpers
  const go = (fallback: string) => {
    const target = parts.next || fallback;
    if (typeof window !== "undefined") window.location.replace(target);
  };
  const goTo = (target: string) => {
    if (typeof window !== "undefined") window.location.replace(target);
  };

  useEffect(() => {
    (async () => {
      setErr(null);
      setMsg(null);

      // 1) Password recovery flow (arrives with type=recovery in the URL hash)
      const hashType = parts.hash.get("type");
      if (hashType === "recovery") {
        await supabase.auth.getSession(); // ensure local session is set
        setStage("recovery");
        return;
      }

      // 2) OAuth PKCE code exchange (provider redirects back with ?code=...)
      const code = parts.query.get("code");
      const errorDesc = parts.query.get("error_description");
      if (errorDesc) {
        setErr(errorDesc);
        setStage("ready");
        return;
      }

      if (code) {
        try {
          setSending(true);
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // If this came from our SIGNUP magic-link flow → onboarding first
          if (parts.flow === "signup") {
            goTo(ONBOARDING);
            return;
          }

          // Otherwise normal behavior (respect ?next=)
          go(REDIRECT_AFTER_AUTH);
          return;
        } catch (e: unknown) {
          setErr(getErrorMessage(e));
          setStage("ready");
        } finally {
          setSending(false);
        }
      } else {
        // 3) Magic-link (email OTP) or already-signed-in return.
        // Supabase auto-parses #access_token/refresh_token in the URL and stores a session.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          // Signed in without ?code (email OTP flow)
          if (parts.flow === "signup") {
            goTo(ONBOARDING);
            return;
          }
          go(REDIRECT_AFTER_AUTH);
          return;
        }
      }

      // Nothing to exchange and no session → show fallback + link back to login
      setMsg("We couldn't complete sign-in. Please try again.");
      setStage("ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Submit new password (recovery)
  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!newPw || !confirmPw) return setErr("Please enter and confirm your new password.");
    if (newPw !== confirmPw) return setErr("Passwords do not match.");

    try {
      setSending(true);
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setMsg("Password updated. Redirecting…");
      setTimeout(() => window.location.replace(REDIRECT_AFTER_AUTH), 800);
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (stage === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--text)]">
        <p>Completing sign-in…</p>
      </div>
    );
  }

  if (stage === "recovery") {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--text)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-2">Set a new password</h1>
          <p className="text-sm text-[var(--muted)] mb-4">
            You arrived via a password reset link. Choose a new password to finish.
          </p>
          <form className="grid gap-3" onSubmit={onResetPassword}>
            <label className="text-sm" htmlFor="newPw">New password</label>
            <input
              id="newPw"
              type="password"
              className="h-10 rounded-lg px-3 border border-[var(--border)] bg-[var(--panel)]"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              disabled={sending}
              required
            />
            <label className="text-sm" htmlFor="confirmPw">Confirm password</label>
            <input
              id="confirmPw"
              type="password"
              className="h-10 rounded-lg px-3 border border-[var(--border)] bg-[var(--panel)]"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              disabled={sending}
              required
            />
            <button
              type="submit"
              disabled={sending}
              className="mt-2 h-10 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition disabled:opacity-60"
            >
              {sending ? "Updating…" : "Update password"}
            </button>
          </form>
          {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
          {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
        </div>
      </div>
    );
  }

  // Ready but not recovering: show fallback UI
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--text)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Sign-in status</h1>
        {err && <p className="text-sm text-rose-400 mb-2">{err}</p>}
        {msg && <p className="text-sm text-[var(--muted)] mb-4">{msg}</p>}
        <a
          className="inline-block h-10 px-6 leading-10 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition"
          href="/login"
        >
          Back to login
        </a>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : JSON.stringify(m);
  }
  return "Unexpected error. Please try again.";
}
