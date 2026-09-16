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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/abuse");
    const data = (await res.json().catch(() => ({}))) as { clusters?: Cluster[] };
    setClusters(data.clusters || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function block(kind: string, key: string, label: string) {
    setBusy(label);
    const res = await fetch("/api/admin/abuse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "block", kind, key, reason: "blocked from the abuse page" }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy("");
    setMsg(data.error || `Blocked ${kind === "device" ? "device" : "network"} — no new account can be opened from it`);
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
