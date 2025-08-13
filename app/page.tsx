"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

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

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Form
  const [txType, setTxType] = useState<TxType>("Expense");
  const [date, setDate] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

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

  // Ensure profile row + load data
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      await supabase.from("profiles").upsert({ id: session.user.id });
      await fetchCategories();
      await fetchTransactions();
    })();
  }, [session]);

  // Fetchers
  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, type, name")
      .order("type")
      .order("name");
    if (!error && data) setCategories(data as Category[]);
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
    user_id: string;
    date: string;
    type: TxType;
    category_id: string | null;
    description: string | null;
    amount: number;
    frequency: string | null;
    notes: string | null;
  };

  // Add transaction
  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !amount) return;
    setSubmitting(true);
    const payload: NewTransactionPayload = {
      user_id: session!.user.id,
      date,
      type: txType,
      category_id: categoryId || null,
      description: description || null,
      amount: Number(amount),
      frequency: frequency || null,
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
  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) alert(error.message);
    else alert("Check your email for a login link.");
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    setCategories([]);
    setTransactions([]);
  };

  if (loading)
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!session) return <AuthScreen onSignIn={signInWithEmail} />;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 bg-[color:rgba(60,63,65,0.85)] backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Finance Tracker</h1>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-[var(--muted)]">
              Income:{" "}
              <span className="font-medium">{money(totals.income)}</span> ·{" "}
              Expenses:{" "}
              <span className="font-medium">{money(totals.expenses)}</span> ·{" "}
              Net:{" "}
              <span
                className={cx(
                  "font-semibold",
                  totals.net >= 0 ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {money(totals.net)}
              </span>
            </div>
            <button
              onClick={signOut}
              className="px-3 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid gap-6">
        {/* Add Transaction */}
        <section className="bg-[var(--panel)] rounded-2xl shadow-sm p-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-3">Add Transaction</h2>
          <form onSubmit={onAdd} className="grid md:grid-cols-7 gap-3">
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value as TxType)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
            >
              <option>Expense</option>
              <option>Income</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
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
            <input
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
            />
            <input
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
            >
              <option value="">One-time</option>
              <option>Weekly</option>
              <option>Fortnightly</option>
              <option>Monthly</option>
              <option>Quarterly</option>
            </select>
            <input
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--text)] placeholder:text-[#9aa0a6]"
            />
            <div className="md:col-span-7">
              <button
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-700)] transition"
              >
                {submitting ? "Saving…" : "Add"}
              </button>
            </div>
          </form>
        </section>

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

function AuthScreen({ onSignIn }: { onSignIn: (email: string) => void }) {
  const [email, setEmail] = useState("");
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Finance Tracker</h1>
        <p className="text-sm text-slate-600 mb-4">
          Sign in with a magic link. No passwords.
        </p>
        <input
          className="w-full border rounded-lg px-3 py-2 mb-3"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={() => onSignIn(email)}
          className="w-full px-4 py-2 rounded-xl bg-black text-white hover:bg-slate-800"
        >
          Send login link
        </button>
      </div>
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
