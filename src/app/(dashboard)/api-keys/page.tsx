"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageTransition, MotionSection } from "@/components/ui/motion";
import { Key, Plus, Copy, Trash2, Check, Code, Terminal, AlertTriangle } from "lucide-react";

interface ApiKeyDisplay {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

const codeExamples = [
  {
    lang: "cURL",
    code: `curl -X POST https://api.genesisstudio.ai/api/v1/generate \\
  -H "Authorization: Bearer gs_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A sunset over the ocean", "model": "ltx-video"}'`,
  },
  {
    lang: "Python",
    code: `import requests

response = requests.post(
    "https://api.genesisstudio.ai/api/v1/generate",
    headers={"Authorization": "Bearer gs_your_api_key"},
    json={"prompt": "A sunset over the ocean", "model": "ltx-video"}
)
print(response.json())`,
  },
  {
    lang: "Node.js",
    code: `const response = await fetch(
  "https://api.genesisstudio.ai/api/v1/generate",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer gs_your_api_key",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: "A sunset over the ocean",
      model: "ltx-video",
    }),
  }
);
const data = await response.json();`,
  },
];

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewKeyValue(data.key);
        setKeys((prev) => [
          {
            id: data.id,
            name: newKeyName,
            keyPrefix: data.key.slice(0, 11),
            createdAt: new Date().toISOString(),
            isActive: true,
          },
          ...prev,
        ]);
        setNewKeyName("");
        toast("API key created successfully", "success");
      }
    } catch (err) {
      console.error("Failed to create key:", err);
      toast("Failed to create API key", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = () => {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue);
      setCopied(true);
      toast("API key copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await fetch(`/api/keys/${keyId}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      setRevokeTarget(null);
      toast("API key revoked", "info");
    } catch (err) {
      console.error("Failed to revoke key:", err);
      toast("Failed to revoke key", "error");
    }
  };

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">API Keys</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your API keys for programmatic access to Genesis Studio.
        </p>
      </div>

      {/* Create New Key */}
      <Card glow>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-violet-400" />
            </div>
            Create New API Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Key name (e.g., Production, Development)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
            />
            <Button onClick={handleCreateKey} loading={isCreating} disabled={!newKeyName.trim()}>
              <Key className="w-4 h-4" /> Create Key
            </Button>
          </div>

          {newKeyValue && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs text-emerald-400 font-medium">
                  Copy this key now — it won&apos;t be shown again
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2.5 rounded-lg bg-black/40 text-sm text-emerald-300 font-mono break-all border border-emerald-500/10">
                  {newKeyValue}
                </code>
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-10 relative">
              <div className="absolute inset-0 bg-glow-center opacity-20" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <Key className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-400">No API keys yet</p>
                <p className="text-xs text-zinc-600 mt-1">Create one above to get started</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center gap-4 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{key.name}</span>
                      <Badge variant={key.isActive ? "emerald" : "red"}>
                        {key.isActive ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <code className="text-xs text-zinc-500 font-mono">
                      {key.keyPrefix}...
                    </code>
                  </div>
                  <div className="text-xs text-zinc-600 shrink-0">
                    {key.lastUsedAt ? `Last used ${key.lastUsedAt}` : "Never used"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRevokeTarget(key.id)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Code className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Language tabs */}
          <div className="flex gap-1 mb-3 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] w-fit">
            {codeExamples.map((ex, i) => (
              <button
                key={ex.lang}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === i
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {ex.lang}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-[#0D0D14] border border-white/[0.04] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">{codeExamples[activeTab].lang}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeExamples[activeTab].code);
                  toast("Code copied!", "success");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto leading-relaxed">
              {codeExamples[activeTab].code}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke API Key"
        description="This action cannot be undone."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Any applications using this key will lose access immediately.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => revokeTarget && handleRevoke(revokeTarget)}>
              <Trash2 className="w-3 h-3" /> Revoke Key
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
