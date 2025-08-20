"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const REDIRECT_AFTER_ONBOARD = "/dashboard";

// Very small country→currency map (extend anytime)
const COUNTRY_TO_CCY: Record<string, string> = {
  AU: "AUD",
  US: "USD",
  GB: "GBP",
  BR: "BRL",
  CA: "CAD",
  NZ: "NZD",
  SG: "SGD",
  IN: "INR",
  EU: "EUR",
};

const COUNTRY_OPTIONS = [
  { code: "AU", name: "Australia" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "IN", name: "India" },
  { code: "EU", name: "European Union" },
];

function guessCountry(): string {
  if (typeof window === "undefined") return "AU";
  const lang = navigator.language || "";
  const part = lang.split("-")[1]?.toUpperCase();
  return COUNTRY_OPTIONS.find((c) => c.code === part)?.code ?? "AU";
}

export default function OnboardingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<string>("AU");
  const currency = useMemo(() => COUNTRY_TO_CCY[country] ?? "AUD", [country]);

  // NEW: password fields
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session ?? null;
      setSession(s);

      // Prefill name from auth metadata if available
      const metaName = (s?.user?.user_metadata?.full_name as string | undefined) ?? "";
      if (metaName) setFullName(metaName);

      // Guess country from browser locale on first load
      setCountry(guessCountry());

      setLoading(false);
    })();
  }, []);

  // No session? Send back to sign-up
  if (!loading && !session) {
    if (typeof window !== "undefined") window.location.replace("/signup");
    return null;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    // Validate required fields
    if (!fullName.trim()) return setErr("Please enter your name.");
    if (!country) return setErr("Please choose a country.");
    if (!currency) return setErr("Currency is required.");
    if (!password || !confirmPw) return setErr("Please set and confirm your password.");
    if (password !== confirmPw) return setErr("Passwords do not match.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");

    setSaving(true);
    try {
      // 1) Set password for the magic-link-created user
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;

      // 2) Upsert profile and mark onboarding complete
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("No user found.");

      const { error: upsertErr } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim(),
        country,
        currency,
        onboarding_complete: true, // <- make sure this column exists
      });
      if (upsertErr) throw upsertErr;

      // 3) Done
      if (typeof window !== "undefined") window.location.replace(REDIRECT_AFTER_ONBOARD);
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] grid place-items-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Welcome! Let’s personalize things.</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          We’ll use these to format your dashboard and reports.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <div>
            <label className="block text-sm mb-1">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Country/Region</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)]"
                required
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Preferred currency</label>
              <input
                value={currency}
                readOnly
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--muted)]"
              />
              <p className="text-[var(--muted)] text-xs mt-1">
                Derived from country. You can change this later in Settings.
              </p>
            </div>
          </div>

          {/* NEW: password fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Create password</label>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Confirm password</label>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)]"
                required
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

/* helpers */
function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : JSON.stringify(m);
  }
  return "Unexpected error. Please try again.";
}
