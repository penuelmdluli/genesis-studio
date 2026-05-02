"use client";

import { useState, useEffect } from "react";

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  deps: Record<string, string>;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setHealth(data);
        setError(null);
      } catch {
        setError("Failed to reach health endpoint");
      } finally {
        setLoading(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = (s: string) =>
    s === "ok" ? "bg-emerald-500" : s === "degraded" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">System Status</h1>

      {loading && <p className="text-zinc-400">Checking...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {health && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusColor(health.status)}`} />
            <span className="text-lg font-semibold text-zinc-100 capitalize">
              {health.status === "ok" ? "All Systems Operational" : health.status}
            </span>
          </div>

          <div className="bg-zinc-900 rounded-lg border border-zinc-800 divide-y divide-zinc-800">
            {Object.entries(health.deps).map(([name, status]) => (
              <div key={name} className="flex items-center justify-between px-4 py-3">
                <span className="text-zinc-300 capitalize">{name}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColor(status)}`} />
                  <span className={status === "ok" ? "text-emerald-400" : "text-red-400"}>
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-400">
            Version: {health.version} | Last checked: {new Date(health.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
