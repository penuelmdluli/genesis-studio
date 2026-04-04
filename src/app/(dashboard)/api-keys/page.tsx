"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Copy, Trash2, Check, Eye, EyeOff, Code } from "lucide-react";

interface ApiKeyDisplay {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
      }
    } catch (err) {
      console.error("Failed to create key:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = () => {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await fetch(`/api/keys/${keyId}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) {
      console.error("Failed to revoke key:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">API Keys</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your API keys for programmatic access to Genesis Studio.
        </p>
      </div>

      {/* Create New Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4 text-violet-400" />
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
            />
            <Button onClick={handleCreateKey} loading={isCreating} disabled={!newKeyName.trim()}>
              <Key className="w-4 h-4" /> Create Key
            </Button>
          </div>

          {newKeyValue && (
            <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 mb-2 font-medium">
                Your new API key (copy it now — it won&apos;t be shown again):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-black/50 text-sm text-emerald-300 font-mono break-all">
                  {newKeyValue}
                </code>
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
            <div className="text-center py-8">
              <Key className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No API keys yet. Create one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30"
                >
                  <Key className="w-4 h-4 text-zinc-500 shrink-0" />
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
                    size="sm"
                    onClick={() => handleRevoke(key.id)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="w-4 h-4 text-cyan-400" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-black/50 p-4 font-mono text-sm overflow-x-auto">
            <div className="text-zinc-500"># Generate a video</div>
            <div className="text-zinc-300 mt-1">
              curl -X POST {process.env.NEXT_PUBLIC_APP_URL || "https://api.genesisstudio.ai"}/api/v1/generate \
            </div>
            <div className="text-zinc-300 pl-4">
              -H &quot;Authorization: Bearer gs_your_api_key&quot; \
            </div>
            <div className="text-zinc-300 pl-4">
              -H &quot;Content-Type: application/json&quot; \
            </div>
            <div className="text-zinc-300 pl-4">
              {`-d '{"prompt": "A sunset over the ocean", "model": "ltx-video", "resolution": "720p"}'`}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
