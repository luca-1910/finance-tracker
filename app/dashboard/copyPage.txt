"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { Chevron } from "../components/Chevron";
import Disclosure from "../components/Disclosure";

// Supabase client (uses your .env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnon);

// Helpers
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function money(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "AUD" });
}

// Types
type TxType = "Income" | "Expense";
type Category = { id: string; type: TxType; name: string };
type Transaction = {
  id: string;
  date: string;
  type: TxType;
  category_id: string | null;
  description: string | null;
  amount: number;
  frequency: string | null;
  notes: string | null;
};
// ─────────────────────────────────────────────────────────────
// GOALS: type + local state
// This type mirrors the columns we created in the DB.
// We keep it small so UI stays simple for now.
type Goal = {
  id: string; // primary key
  name: string; // "Tuition 2026", "Emergency Fund", etc.
  target_amount: number; // how much you want to reach
  due_date: string | null; // optional ISO date (YYYY-MM-DD)
  status: "active" | "paused" | "achieved" | "cancelled"; // current state
  notes: string | null; // optional notes
};

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  // ── Display name to show in the header
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Collapsible "Summary" (totals) state. Default = open. We read/write localStorage so it persists.
  const [showTotals, setShowTotals] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("showTotals");
    return v === null ? true : v === "true";
  });

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // List of goals for the dropdown and a single selected goal for the form.
  const [goalId, setGoalId] = useState<string>(""); // controlled value for the Goal <select>
  const [goals, setGoals] = useState<Goal[]>([]);

  // Form
  const [txType, setTxType] = useState<TxType>("Expense");
  const [date, setDate] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // One class for all controls so they size consistently and can shrink
  const ctl =
  "w-full min-w-0 h-10 px-3 rounded-lg border border-[var(--border)] " +
  "bg-[var(--panel)] text-[var(--text)] text-base sm:text-sm leading-tight " +
  "placeholder:text-[#9aa0a6] truncate appearance-none " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40";

  // Bootstrap auth
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
      supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("showTotals", String(showTotals));
    }
  }, [showTotals]);

  // Ensure profile row + load data
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      await supabase.from("profiles").upsert({ id: session.user.id });
      await fetchCategories();
      await fetchTransactions();
      await fetchGoals();
      await fetchDisplayName();
    })();
  }, [session]);

  // ─────────────────────────────────────────────────────────────
  // Fetch the user's full_name for header display (fallback to email)
  // ─────────────────────────────────────────────────────────────
  const fetchDisplayName = async () => {
    if (!session?.user?.id) return;

    // Try to read full_name from your profiles table
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();

    if (!error) {
      // Prefer full_name; if empty, show the email; final fallback "You"
      setDisplayName(data?.full_name || session.user.email || "You");
    }
  };

  // Fetchers
  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, type, name")
      .order("type")
      .order("name");
    if (!error && data) setCategories(data as Category[]);
  };

  // ─────────────────────────────────────────────────────────────
  // Fetch all goals for the current user (RLS restricts to your rows).
  // We keep the selection minimal; extend if you need more fields.
  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from("goals")
      .select("id, name, target_amount, due_date, status, notes")
      .order("created_at", { ascending: false });

    // If there’s no error, update local state so the UI can render the dropdown.
    if (!error && data) {
      setGoals(data as Goal[]);
    } else if (error) {
      console.error("fetchGoals error:", error.message);
    }
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, date, type, category_id, description, amount, frequency, notes"
      )
      .order("date", { ascending: false })
      .limit(200);
    if (!error && data) setTransactions(data as Transaction[]);
  };

  // Totals
  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "Income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = transactions
      .filter((t) => t.type === "Expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return { income, expenses, net: income - expenses };
  }, [transactions]);

  //Define a payload type and pass it directly to insert
  type NewTransactionPayload = {
    user_id: string; // Owner (required for RLS checks)
    date: string; // e.g., "2025-08-13"
    type: "Income" | "Expense"; // enum in DB
    category_id: string | null; // FK to categories (nullable)
    goal_id: string | null; // ← NEW: FK to goals (nullable)
    description: string | null; // free text
    amount: number; // numeric(12,2) in DB
    frequency: string | null; // One-time / Weekly / Fortnightly / Monthly / Quarterly
    notes: string | null; // free text
  };

  // Add transaction
  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !amount) return;
    setSubmitting(true);
    // Build the insert row.
    const payload: NewTransactionPayload = {
      user_id: session!.user.id, // who owns this row (RLS uses this)
      date, // ISO date string from the form
      type: txType, // 'Income' | 'Expense'
      category_id: categoryId || null, // nullable FK to categories
      goal_id: goalId || null, // ← NEW: nullable FK to goals (just a tag)
      description: description || null, // optional text
      amount: Number(amount), // numeric(12,2) in DB
      frequency: frequency || null, // One-time / Weekly / ...
      notes: notes || null,
    };
    const { error } = await supabase.from("transactions").insert(payload);
    setSubmitting(false);
    if (error) {
      alert(error.message);
    } else {
      setDescription("");
      setAmount("");
      setNotes("");
      setGoalId("");
      await fetchTransactions();
    }
  };

  // Delete transaction
  const onDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (!error) setTransactions((txs) => txs.filter((t) => t.id !== id));
  };

  // Auth flows
  if (loading) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }
  // If not authenticated, send the user to the dedicated login page
  if (!session) {
    if (typeof window !== "undefined") {
      // Client-side redirect keeps this as a pure client component
      window.location.href = "/login";
    }
    return null; // Render nothing during the redirect
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setCategories([]);
    setTransactions([]);
  };

  // Header
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 bg-[color:rgba(63,65,69,0.85)] backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 py-3">
          {/* Top row: title + actions — stacks on mobile, row on ≥sm */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Title */}
            <h1 className="text-lg sm:text-xl font-semibold leading-snug">
              Finance Tracker
            </h1>

            {/* Actions — put on a single line on desktop, wrap/stack on mobile */}
            <div className="flex flex-wrap items-center gap-2">
              {/* (Optional) Greeting */}
              <span className="text-xs sm:text-sm text-[var(--muted)]">
                Hi, {displayName}
              </span>
              <a
                href="/profile"
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] hover:bg-[color:#464a4d] text-xs sm:text-sm"
              >
                Profile
              </a>

              <button
                onClick={signOut}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] text-xs sm:text-sm transition"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* ── Summary (collapsible) ───────────────────────────────────── */}
          <div className="mt-3">
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setShowTotals((v) => !v)}
              aria-expanded={showTotals}
              aria-controls="totals-panel"
              className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              <Chevron open={showTotals} />
              <span className="font-medium">Summary</span>
            </button>

            {/* Animated container (height + opacity) */}
            <div
              id="totals-panel"
              className={`transition-all duration-300 overflow-hidden ${
                showTotals
                  ? "max-h-[220px] opacity-100 mt-3"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Income chip */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-[var(--muted)] text-xs">Income</div>
                  <div className="font-medium text-sm sm:text-base leading-snug">
                    {money(totals.income)}
                  </div>
                </div>

                {/* Expenses chip */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-[var(--muted)] text-xs">Expenses</div>
                  <div className="font-medium text-sm sm:text-base leading-snug">
                    {money(totals.expenses)}
                  </div>
                </div>

                {/* Net chip */}
                <div className="col-span-2 sm:col-span-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-[var(--muted)] text-xs">Net</div>
                  <div
                    className={cx(
                      "font-semibold text-sm sm:text-base leading-snug",
                      totals.net >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {money(totals.net)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid gap-6">
        {/* Add Transaction */}
        {/* Add Transaction (collapsible) */}
        <Disclosure
          title="Add Transaction"
          storageKey="panel:add"
          defaultOpen={true}
        >
          <section className="bg-[var(--panel)] rounded-2xl shadow-sm p-4 border border-[var(--border)] w-full max-w-full overflow-visible">
            <form
              onSubmit={onAdd}
              className="
    w-full max-w-full
    grid gap-3
    [grid-template-columns:repeat(1,minmax(0,1fr))]
    sm:[grid-template-columns:repeat(2,minmax(0,1fr))]
    lg:[grid-template-columns:repeat(7,minmax(0,1fr))]
  "
            >
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value as TxType)}
                className={`${ctl} lg:col-span-1`}
              >
                <option>Expense</option>
                <option>Income</option>
              </select>

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${ctl} lg:col-span-1`}
                placeholder="dd/mm/yyyy"
              />

              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`${ctl} lg:col-span-1`}
              >
                <option value="">— Category —</option>
                {categories
                  .filter((c) => c.type === txType)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>

              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className={`${ctl} lg:col-span-1`}
              >
                <option value="">— Goal (optional) —</option>
                {goals
                  .filter((g) => g.status === "active")
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>

              {/* Description gets more space on large screens */}
              <input
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${ctl} sm:col-span-2 lg:col-span-2`}
              />

              <input
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${ctl} lg:col-span-1`}
              />

              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className={`${ctl} lg:col-span-1`}
              >
                <option value="">One-time</option>
                <option>Weekly</option>
                <option>Fortnightly</option>
                <option>Monthly</option>
                <option>Quarterly</option>
              </select>

              {/* Notes spans full width on small; half on sm; 5 cols on lg */}
              <input
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${ctl} sm:col-span-2 lg:col-span-5`}
              />

              {/* Button row */}
              <div className="sm:col-span-2 lg:col-span-2">
                <button
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 h-10 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition"
                >
                  {submitting ? "Saving…" : "Add"}
                </button>
              </div>
            </form>
          </section>
        </Disclosure>

        {/* Transactions */}
        <section className="bg-[var(--panel)] rounded-2xl shadow-sm p-4 border border-[var(--border)]"></section>
        <section className="bg-[var(--panel)] rounded-2xl shadow-sm p-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-3">Recent Transactions</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] hover:bg-[color:#3b3e40]">
                  <th className="py-2 pr-4 text-[var(--muted)]">Date</th>
                  <th className="py-2 pr-4 text-[var(--muted)]">Type</th>
                  <th className="py-2 pr-4 text-[var(--muted)]">Category</th>
                  <th className="py-2 pr-4 text-[var(--muted)]">Description</th>
                  <th className="py-2 pr-4 text-[var(--muted)]">Amount</th>
                  <th className="py-2 pr-4 text-[var(--muted)]">Frequency</th>
                  <th className="py-2 pr-4 text-[var(--muted)]">Notes</th>
                  <th className="py-2 pr-4 text-[var(--muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[var(--border)] hover:bg-[color:#3b3e40]"
                  >
                    <td className="py-2 pr-4">{t.date}</td>
                    <td className="py-2 pr-4">{t.type}</td>
                    <td className="py-2 pr-4">
                      {categories.find((c) => c.id === t.category_id)?.name ||
                        ""}
                    </td>
                    <td className="py-2 pr-4">{t.description}</td>
                    <td className="py-2 pr-4">{money(Number(t.amount))}</td>
                    <td className="py-2 pr-4">{t.frequency || ""}</td>
                    <td className="py-2 pr-4">{t.notes || ""}</td>
                    <td className="py-2">
                      <button
                        onClick={() => onDelete(t.id)}
                        className="px-2 py-1 text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-slate-500" colSpan={8}>
                      No transactions yet. Add your first one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Categories */}
        <CategoryManager categories={categories} onChanged={fetchCategories} />
      </main>
    </div>
  );
}

function CategoryManager({
  categories,
  onChanged,
}: {
  categories: Category[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<TxType>("Expense");
  const [name, setName] = useState("");

  const list = categories.filter((c) => c.type === tab);

  const addCategory = async () => {
    if (!name) return;
    const { error } = await supabase
      .from("categories")
      .insert({ name, type: tab });
    if (error) alert(error.message);
    else {
      setName("");
      onChanged();
    }
  };

  const delCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) alert(error.message);
    else onChanged();
  };

  return (
    <section className="bg-[var(--panel)] rounded-2xl shadow-sm p-4 border border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Categories</h2>
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
          {(["Expense", "Income"] as TxType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-3 py-1.5 text-sm transition " +
                (tab === t
                  ? "bg-[var(--accent)] text-black"
                  : "bg-transparent text-[var(--muted)] hover:bg-[color:#464a4d]")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <ul className="divide-y rounded-xl border">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <span>{c.name}</span>
                <button
                  onClick={() => delCategory(c.id)}
                  className="text-rose-600 hover:underline text-sm"
                >
                  Delete
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="px-3 py-6 text-slate-500 text-sm">
                No categories yet.
              </li>
            )}
          </ul>
        </div>
        <div className="rounded-xl border p-3">
          <label className="block text-sm font-medium mb-1">
            Add {tab} category
          </label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2"
              placeholder="e.g., Rent, Fuel, Two Suns Salary"
            />
            <button
              onClick={addCategory}
              className="px-3 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
