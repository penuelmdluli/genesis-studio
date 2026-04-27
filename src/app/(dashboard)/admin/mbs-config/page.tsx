"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  Users,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Image as ImageIcon,
  UserPlus,
  Music,
  Eye,
  EyeOff,
} from "lucide-react";

interface MBSCharacter {
  id: string;
  name: string;
  description: string;
  portrait_url: string;
  active: boolean;
}

interface MBSCreator {
  id: string;
  handle: string;
  platform: string;
  profile_url: string;
  verified: boolean;
  active: boolean;
}

export default function MBSConfigPage() {
  const { user } = useStore();
  const { toast } = useToast();
  const [characters, setCharacters] = useState<MBSCharacter[]>([]);
  const [creators, setCreators] = useState<MBSCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New character form
  const [newCharName, setNewCharName] = useState("");
  const [newCharDesc, setNewCharDesc] = useState("");
  const [newCharUrl, setNewCharUrl] = useState("");

  // New creator form
  const [newCreatorHandle, setNewCreatorHandle] = useState("");
  const [newCreatorPlatform, setNewCreatorPlatform] = useState("tiktok");
  const [newCreatorUrl, setNewCreatorUrl] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [charsRes, creatorsRes] = await Promise.all([
        fetch("/api/admin/mbs-config/characters"),
        fetch("/api/admin/mbs-config/creators"),
      ]);
      if (charsRes.ok) setCharacters(await charsRes.json());
      if (creatorsRes.ok) setCreators(await creatorsRes.json());
    } catch {
      toast("Failed to load MBS config", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user?.isOwner) {
    return (
      <PageTransition className="flex items-center justify-center h-[60vh]">
        <p className="text-zinc-500">Owner access required.</p>
      </PageTransition>
    );
  }

  const toggleCharacter = async (id: string, active: boolean) => {
    const res = await fetch("/api/admin/mbs-config/characters", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    if (res.ok) {
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, active: !active } : c));
      toast(`Character ${!active ? "activated" : "deactivated"}`, "success");
    }
  };

  const deleteCharacter = async (id: string) => {
    const res = await fetch("/api/admin/mbs-config/characters", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCharacters(prev => prev.filter(c => c.id !== id));
      toast("Character deleted", "success");
    }
  };

  const addCharacter = async () => {
    if (!newCharName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/mbs-config/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCharName, description: newCharDesc, portrait_url: newCharUrl }),
    });
    if (res.ok) {
      const char = await res.json();
      setCharacters(prev => [...prev, char]);
      setNewCharName(""); setNewCharDesc(""); setNewCharUrl("");
      toast("Character added", "success");
    }
    setSaving(false);
  };

  const toggleCreator = async (id: string, active: boolean) => {
    const res = await fetch("/api/admin/mbs-config/creators", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    if (res.ok) {
      setCreators(prev => prev.map(c => c.id === id ? { ...c, active: !active } : c));
      toast(`Creator ${!active ? "activated" : "deactivated"}`, "success");
    }
  };

  const addCreator = async () => {
    if (!newCreatorHandle.trim() || !newCreatorUrl.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/mbs-config/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: newCreatorHandle,
        platform: newCreatorPlatform,
        profile_url: newCreatorUrl,
      }),
    });
    if (res.ok) {
      const creator = await res.json();
      setCreators(prev => [...prev, creator]);
      setNewCreatorHandle(""); setNewCreatorUrl("");
      toast("Creator added", "success");
    }
    setSaving(false);
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">MBS Configuration</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage characters, creators, and dance content pipeline</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData} loading={loading}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Characters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-violet-400" />
            Characters ({characters.length} total, {characters.filter(c => c.active).length} active)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Character Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {characters.map((char) => (
              <div key={char.id} className={`relative rounded-xl border p-3 transition-all ${
                char.active ? "border-violet-500/30 bg-violet-500/5" : "border-white/[0.06] bg-white/[0.02] opacity-50"
              }`}>
                {char.portrait_url && (
                  <img src={char.portrait_url} alt={char.name} className="w-full aspect-[3/4] object-cover rounded-lg mb-2" />
                )}
                <p className="text-sm font-medium text-zinc-200 truncate">{char.name}</p>
                <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{char.description}</p>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => toggleCharacter(char.id, char.active)}
                    className="flex-1 p-1.5 rounded-lg text-[10px] font-medium transition-colors bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400">
                    {char.active ? <><EyeOff className="w-3 h-3 inline" /> Hide</> : <><Eye className="w-3 h-3 inline" /> Show</>}
                  </button>
                  <button onClick={() => deleteCharacter(char.id)}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Character */}
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-medium text-zinc-400 mb-3">Add New Character</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input placeholder="Name" value={newCharName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCharName(e.target.value)} className="text-sm" />
              <Input placeholder="Description" value={newCharDesc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCharDesc(e.target.value)} className="text-sm" />
              <Input placeholder="Portrait URL (R2 or FAL)" value={newCharUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCharUrl(e.target.value)} className="text-sm" />
              <Button variant="primary" size="sm" onClick={addCharacter} loading={saving} disabled={!newCharName.trim()}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creators Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Music className="w-4 h-4 text-cyan-400" />
            Source Creators ({creators.length} total, {creators.filter(c => c.active).length} active)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {creators.map((creator) => (
              <div key={creator.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                creator.active ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-50"
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">@{creator.handle}</span>
                    <Badge variant={creator.platform === "tiktok" ? "violet" : "cyan"} className="text-[9px]">
                      {creator.platform}
                    </Badge>
                    {creator.verified && <Badge variant="emerald" className="text-[9px]">Verified</Badge>}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{creator.profile_url}</p>
                </div>
                <button onClick={() => toggleCreator(creator.id, creator.active)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 transition-colors">
                  {creator.active ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>

          {/* Add Creator */}
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-medium text-zinc-400 mb-3">Add New Creator</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input placeholder="Handle (e.g. squidboycally)" value={newCreatorHandle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCreatorHandle(e.target.value)} className="text-sm" />
              <select value={newCreatorPlatform} onChange={(e) => setNewCreatorPlatform(e.target.value)}
                className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 px-3 py-2">
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
              <Input placeholder="Profile URL" value={newCreatorUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCreatorUrl(e.target.value)} className="text-sm" />
              <Button variant="primary" size="sm" onClick={addCreator} loading={saving} disabled={!newCreatorHandle.trim()}>
                <UserPlus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
