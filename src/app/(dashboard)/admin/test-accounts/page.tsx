"use client";

// Owner tool: create ready-to-use logins for Google Play / App Store reviewers
// and QA, top them up, reset their passwords.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, KeyRound, Plus, RefreshCw, UserPlus } from "lucide-react";

interface Account {
  user_id: string;
  label: string | null;
  created_at: string;
  user: { id: string; email: string; name: string; plan: string; credit_balance: number; plan_expires_at: string | null };
}

const PLAY_INSTRUCTIONS =
  "Sign in on the first screen with the email and password above (tap Sign in, then enter them). The account is already active on the Pro plan with credits, so every feature, including creating videos, works without payment.";

function strongPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return "Ivs-" + [...bytes].map((b) => chars[b % chars.length]).join("");
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:text-white"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function TestAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", name: "Google Play Reviewer", password: "", plan: "pro", credits: 2000, label: "Google Play review" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async (_reason: string) => {
    try {
      const res = await fetch("/api/admin/test-accounts");
      if (res.ok) setAccounts(((await res.json()) as { accounts: Account[] }).accounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("mount");
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/test-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not create the account");
    setCreated({ email: form.email.toLowerCase().trim(), password: form.password });
    setForm((f) => ({ ...f, email: "", password: "" }));
    load("created");
  }

  async function patch(userId: string, body: Record<string, unknown>) {
    const res = await fetch("/api/admin/test-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    });
    if (!res.ok) alert(((await res.json().catch(() => ({}))) as { error?: string }).error || "Update failed");
    load("patched");
  }

  const input = "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-white">
          <UserPlus className="h-6 w-6 text-violet-400" /> Test accounts
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Ready-to-use logins for Google Play reviewers and testers. Created active on a paid plan with credits, no welcome
          email, left out of marketing.
        </p>
      </div>

      {created && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="font-semibold text-emerald-300">Account ready. Paste these into Play Console → App content → Sign in details.</p>
          <p className="mt-1 text-xs text-emerald-200/70">The password is only shown now. Save it somewhere safe before leaving this page.</p>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Username / email", created.email],
              ["Password", created.password],
              ["Any other information", PLAY_INSTRUCTIONS],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                <dt className="w-44 shrink-0 text-zinc-400">{k}</dt>
                <dd className="flex-1 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-zinc-100">{v}</dd>
                <CopyButton text={v} />
              </div>
            ))}
          </dl>
        </div>
      )}

      <form onSubmit={create} className="space-y-4 rounded-2xl border border-white/10 bg-[#111118] p-5">
        <h2 className="font-semibold text-white">New test account</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-300">
            Email (username)
            <input className={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="playreview@yourdomain.com" />
          </label>
          <label className="text-sm text-zinc-300">
            Name
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="text-sm text-zinc-300">
            Password
            <div className="flex gap-2">
              <input className={input} type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
              <button type="button" onClick={() => setForm({ ...form, password: strongPassword() })} className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:text-white">
                <KeyRound className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
          </label>
          <label className="text-sm text-zinc-300">
            Label
            <input className={input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </label>
          <label className="text-sm text-zinc-300">
            Plan
            <select className={input} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="pro">Pro (all features)</option>
              <option value="studio">Studio</option>
              <option value="creator">Creator</option>
              <option value="free">Free</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Credits
            <input className={input} type="number" min={0} max={20000} value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} />
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          <Plus className="h-4 w-4" /> {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <div className="rounded-2xl border border-white/10 bg-[#111118]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="font-semibold text-white">Existing test accounts</h2>
          <button onClick={() => load("refresh")} className="text-zinc-400 hover:text-white" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-zinc-500">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {accounts.map((a) => (
              <li key={a.user_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">{a.user.email}</p>
                  <p className="text-xs text-zinc-400">
                    {a.label || "Test"} · {a.user.plan} · {a.user.credit_balance.toLocaleString()} credits
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => patch(a.user_id, { addCredits: 1000 })} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
                    +1,000 credits
                  </button>
                  <button
                    onClick={() => {
                      const pw = prompt("New password (at least 8 characters)");
                      if (pw) patch(a.user_id, { password: pw });
                    }}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                  >
                    Reset password
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
