"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, type Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  // If already authenticated, skip landing → dashboard
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

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-4">Welcome to Finance Tracker</h1>
      <p className="text-lg text-[var(--muted)] mb-8">
        Track your expenses, set goals, and achieve financial freedom.
      </p>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-700)] text-black font-semibold transition"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="px-6 py-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] hover:bg-[color:#464a4d] text-[var(--text)] font-semibold transition"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}