"use client";

import { useCallback, useEffect, useState } from "react";

interface Member {
  userId: string;
  email: string;
  name: string | null;
  createdAt: string;
  credits: number;
  suspended: number;
  jobs: number;
  generatedEmail: boolean;
}

interface Attempt {
  created_at: string;
  outcome: string;
  route: string;
  email: string | null;
  ip: string | null;
  country: string | null;
  reason: string | null;
}

interface AttemptSource {
  ip_prefix: string;
  country: string | null;
  n: number;
  last_seen: string;
}

interface Blocked {
  kind: string;
  value: string;
  reason: string | null;
  hits: number;
  created_at: string;
}

interface Totals {
  outcome: string;
  n: number;
  last_seen: string;
}

interface Cluster {
  kind: "device" | "network" | "fingerprint";
  key: string;
  accounts: number;
  creditsHeld: number;
  jobs: number;
  firstSeen: string;
  lastSeen: string;
  country: string | null;
  asn: string | null;
  members: Member[];
  reasons: string[];
}

const KIND_LABEL: Record<Cluster["kind"], string> = {
  device: "Same device",
  fingerprint: "Same browser fingerprint",
  network: "Same network",
};

const KIND_COLOR: Record<Cluster["kind"], string> = {
  device: "bg-red-500/15 text-red-300 border-red-500/30",
  fingerprint: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  network: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

export default function AbusePage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [blocks, setBlocks] = useState<Blocked[]>([]);
  const [attempts, setAttempts] = useState<{ totals: Totals[]; sources: AttemptSource[]; recent: Attempt[] }>({
    totals: [],
    sources: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/abuse");
    const data = (await res.json().catch(() => ({}))) as {
      clusters?: Cluster[];
      blocks?: Blocked[];
      attempts?: { totals: Totals[]; sources: AttemptSource[]; recent: Attempt[] };
    };
    setClusters(data.clusters || []);
    setBlocks(data.blocks || []);
    setAttempts(data.attempts || { totals: [], sources: [], recent: [] });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function block(kind: string, key: string, label: string, action: "block" | "unblock" = "block") {
    setBusy(label);
    const res = await fetch("/api/admin/abuse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, kind, key, reason: "blocked from the abuse page" }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy("");
    setMsg(
      data.error ||
        (action === "block"
          ? `Blocked — nothing can sign up from this ${kind === "ip_prefix" ? "network" : kind} again`
          : "Unblocked")
    );
    load();
  }

  async function act(action: string, userIds: string[], label: string) {
    setBusy(label);
    setMsg("");
    const res = await fetch("/api/admin/abuse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userIds }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; added?: number };
    setBusy("");
    setMsg(data.error || (data.added !== undefined ? `Linked ${data.added} older accounts` : "Done"));
    load();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Multi-account abuse</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Accounts that share a device, network or browser. Free credits are already withheld automatically
            from a second account on the same device.
          </p>
        </div>
        <button
          onClick={() => act("backfill", ["x"], "backfill")}
          disabled={!!busy}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
        >
          {busy === "backfill" ? "Linking…" : "Link older accounts"}
        </button>
      </div>

      {msg && <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">{msg}</p>}

      {(attempts.totals.length > 0 || blocks.length > 0) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#111118] p-5">
            <h2 className="font-semibold">Attempts turned away</h2>
            {attempts.totals.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">None yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {attempts.totals.map((t) => (
                  <li key={t.outcome} className="flex justify-between gap-3">
                    <span className="text-zinc-300">
                      {t.outcome === "blocked"
                        ? "Refused (on blocklist)"
                        : t.outcome === "auto_blocked"
                          ? "Auto-blocked at sign-up"
                          : "Free credits withheld"}
                    </span>
                    <span className="font-semibold">
                      {t.n}
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        last {String(t.last_seen).slice(5, 16).replace("T", " ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {attempts.sources.length > 0 && (
              <>
                <p className="mt-4 text-xs uppercase text-zinc-500">Busiest networks</p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {attempts.sources.map((src) => (
                    <li key={src.ip_prefix} className="flex justify-between gap-3">
                      <span className="font-mono text-xs text-zinc-300">
                        {src.ip_prefix} {src.country ? `\u00b7 ${src.country}` : ""}
                      </span>
                      <span>{src.n} tries</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111118] p-5">
            <h2 className="font-semibold">Blocklist ({blocks.length})</h2>
            {blocks.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">Nothing blocked yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {blocks.map((b) => (
                  <li key={`${b.kind}-${b.value}`} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-zinc-300">
                        {b.kind}: {b.value.length > 26 ? b.value.slice(0, 26) + "\u2026" : b.value}
                      </p>
                      <p className="truncate text-xs text-zinc-500">{b.reason}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-zinc-400">{b.hits || 0} hits</span>
                      <button
                        onClick={() => block(b.kind, b.value, `unblock-${b.value}`, "unblock")}
                        className="ml-3 text-xs text-zinc-500 underline hover:text-white"
                      >
                        unblock
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {attempts.recent.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#111118] p-5">
          <h2 className="font-semibold">Latest attempts</h2>
          <div className="mt-3 max-h-72 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {attempts.recent.map((a, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1.5 pr-3 text-zinc-400">{String(a.created_at).slice(5, 16).replace("T", " ")}</td>
                    <td className="py-1.5 pr-3">{a.email || "\u2014"}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-zinc-400">
                      {a.ip} {a.country ? `\u00b7 ${a.country}` : ""}
                    </td>
                    <td className="py-1.5 text-xs text-zinc-500">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-zinc-400">Loading…</p>
      ) : clusters.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">No shared devices or networks found. 🎉</p>
      ) : (
        <div className="mt-6 space-y-5">
          {clusters.map((c) => {
            const active = c.members.filter((m) => !m.suspended);
            return (
              <div key={`${c.kind}-${c.key}`} className="rounded-2xl border border-white/10 bg-[#111118] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${KIND_COLOR[c.kind]}`}>
                      {KIND_LABEL[c.kind]}
                    </span>
                    <p className="mt-2 font-semibold">
                      {c.accounts} accounts · {c.creditsHeld.toLocaleString()} credits · {c.jobs} generations
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {c.reasons.join(" · ")}
                      {c.country ? ` · ${c.country}` : ""}
                      {c.asn ? ` · ${c.asn}` : ""}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">{c.key}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => block(c.kind === "network" ? "ip_prefix" : c.kind, c.key, `block-${c.key}`)}
                      disabled={!!busy}
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
                    >
                      {busy === `block-${c.key}` ? "Blocking…" : "Block this " + (c.kind === "network" ? "network" : "device")}
                    </button>
                  {active.length > 0 && (
                    <button
                      onClick={() =>
                        act(
                          "suspend",
                          active.map((m) => m.userId),
                          c.key
                        )
                      }
                      disabled={!!busy}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {busy === c.key ? "Suspending…" : `Suspend ${active.length}`}
                    </button>
                  )}
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="py-1 pr-3">Email</th>
                        <th className="py-1 pr-3">Joined</th>
                        <th className="py-1 pr-3">Credits</th>
                        <th className="py-1 pr-3">Jobs</th>
                        <th className="py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.members.map((m) => (
                        <tr key={m.userId} className="border-t border-white/5">
                          <td className="py-1.5 pr-3">
                            {m.email}
                            {m.generatedEmail && <span className="ml-2 text-xs text-amber-400">random</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-zinc-400">{String(m.createdAt).slice(0, 16).replace("T", " ")}</td>
                          <td className="py-1.5 pr-3">{m.credits}</td>
                          <td className="py-1.5 pr-3">{m.jobs}</td>
                          <td className="py-1.5">
                            {m.suspended ? (
                              <button
                                onClick={() => act("restore", [m.userId], m.userId)}
                                className="text-xs text-zinc-400 underline hover:text-white"
                              >
                                suspended · restore
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-400">active</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
