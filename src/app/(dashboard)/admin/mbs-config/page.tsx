"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/motion";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  UserPlus,
  Music,
  Eye,
  EyeOff,
  ExternalLink,
  Image as ImageIcon,
  Zap,
  Shield,
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

function CharacterCard({ char, onToggle, onDelete }: {
  char: MBSCharacter;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className={`group relative rounded-2xl border overflow-hidden transition-all duration-300 ${
      char.active
        ? "border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-transparent hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10"
        : "border-white/[0.06] bg-white/[0.01] opacity-40 hover:opacity-60"
    }`}>
      {/* Image */}
      <div className="relative aspect-[3/4] bg-[#0D0D14] overflow-hidden">
        {char.portrait_url && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0D0D14]">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center animate-pulse">
                  <ImageIcon className="w-4 h-4 text-violet-400/50" />
                </div>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={char.portrait_url}
              alt={char.name}
              className={`w-full h-full object-cover transition-all duration-500 ${imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-900/20 to-fuchsia-900/10">
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-violet-400/50" />
            </div>
            <span className="text-[10px] text-zinc-600">No image</span>
          </div>
        )}

        {/* Active badge overlay */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase backdrop-blur-md ${
            char.active ? "bg-emerald-500/80 text-white" : "bg-zinc-800/80 text-zinc-400"
          }`}>
            {char.active ? "Active" : "Hidden"}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
          <div className="flex gap-1.5 w-full">
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                char.active
                  ? "bg-amber-500/80 hover:bg-amber-500 text-white"
                  : "bg-emerald-500/80 hover:bg-emerald-500 text-white"
              }`}
            >
              {char.active ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Activate</>}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="px-2 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-zinc-100">{char.name}</p>
        <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5 leading-relaxed">{char.description}</p>
      </div>
    </div>
  );
}

export default function MBSConfigPage() {
  const { user, isInitialized } = useStore();
  const { toast } = useToast();
  const [characters, setCharacters] = useState<MBSCharacter[]>([]);
  const [creators, setCreators] = useState<MBSCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddChar, setShowAddChar] = useState(false);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  useEffect(() => {
    if (isInitialized && user?.isOwner) fetchData();
  }, [fetchData, isInitialized, user?.isOwner]);

  if (!isInitialized) {
    return (
      <PageTransition className="flex items-center justify-center h-[60vh]">
        <GenesisLoader size="sm" text="Loading..." />
      </PageTransition>
    );
  }

  if (!user?.isOwner) {
    return (
      <PageTransition className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Shield className="w-12 h-12 text-zinc-700" />
        <p className="text-zinc-500 text-lg">Owner access required</p>
      </PageTransition>
    );
  }

  const toggleCharacter = async (id: string, active: boolean) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, active: !active } : c));
    const res = await fetch("/api/admin/mbs-config/characters", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    if (res.ok) {
      toast(`Character ${!active ? "activated" : "hidden"}`, "success");
    } else {
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, active } : c));
      toast("Failed to update character", "error");
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
    } else {
      toast("Failed to delete", "error");
    }
    setConfirmDelete(null);
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
      setShowAddChar(false);
      toast("Character added!", "success");
    } else {
      toast("Failed to add character", "error");
    }
    setSaving(false);
  };

  const toggleCreator = async (id: string, active: boolean) => {
    setCreators(prev => prev.map(c => c.id === id ? { ...c, active: !active } : c));
    const res = await fetch("/api/admin/mbs-config/creators", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    if (res.ok) {
      toast(`Creator ${!active ? "enabled" : "disabled"}`, "success");
    } else {
      setCreators(prev => prev.map(c => c.id === id ? { ...c, active } : c));
    }
  };

  const addCreator = async () => {
    if (!newCreatorHandle.trim() || !newCreatorUrl.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/mbs-config/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: newCreatorHandle, platform: newCreatorPlatform, profile_url: newCreatorUrl }),
    });
    if (res.ok) {
      const creator = await res.json();
      setCreators(prev => [...prev, creator]);
      setNewCreatorHandle(""); setNewCreatorUrl("");
      setShowAddCreator(false);
      toast("Creator added!", "success");
    } else {
      toast("Failed to add creator", "error");
    }
    setSaving(false);
  };

  const activeChars = characters.filter(c => c.active);
  const hiddenChars = characters.filter(c => !c.active);

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">MBS Configuration</h1>
              <p className="text-xs sm:text-sm text-zinc-500">Manage characters, creators, and the content pipeline</p>
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData} loading={loading}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Characters", value: activeChars.length, color: "violet" },
          { label: "Hidden Characters", value: hiddenChars.length, color: "zinc" },
          { label: "Active Creators", value: creators.filter(c => c.active).length, color: "cyan" },
          { label: "Total Creators", value: creators.length, color: "zinc" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color === "violet" ? "text-violet-400" : stat.color === "cyan" ? "text-cyan-400" : "text-zinc-400"}`}>
              {stat.value}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Characters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-violet-400" />
              Characters
              <Badge variant="violet" className="text-[10px]">{activeChars.length} active</Badge>
            </CardTitle>
            <Button variant="primary" size="sm" onClick={() => setShowAddChar(!showAddChar)}>
              <Plus className="w-3.5 h-3.5" /> Add Character
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Character Form */}
          {showAddChar && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-violet-300">New Character</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Name (e.g. Bongani)" value={newCharName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCharName(e.target.value)} className="text-sm" />
                <Input placeholder="Portrait URL (R2 public URL)" value={newCharUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCharUrl(e.target.value)} className="text-sm" />
              </div>
              <Input placeholder="Description (e.g. 3 toddler boys, streetwear, Sandton Mall, crowd cheering)" value={newCharDesc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCharDesc(e.target.value)} className="text-sm" />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={addCharacter} loading={saving} disabled={!newCharName.trim()}>
                  <Plus className="w-3.5 h-3.5" /> Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddChar(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Character Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-white/[0.06] overflow-hidden">
                  <div className="aspect-[3/4] bg-white/[0.04]" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-20 bg-white/[0.06] rounded" />
                    <div className="h-3 w-full bg-white/[0.04] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {characters.map((char) => (
                <CharacterCard
                  key={char.id}
                  char={char}
                  onToggle={() => toggleCharacter(char.id, char.active)}
                  onDelete={() => confirmDelete === char.id ? deleteCharacter(char.id) : setConfirmDelete(char.id)}
                />
              ))}
            </div>
          )}

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-300 flex-1">
                Delete {characters.find(c => c.id === confirmDelete)?.name}? This cannot be undone.
              </span>
              <Button variant="danger" size="sm" onClick={() => deleteCharacter(confirmDelete)}>Delete</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Creators Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Music className="w-4 h-4 text-cyan-400" />
              Source Creators
              <Badge variant="cyan" className="text-[10px]">{creators.filter(c => c.active).length} active</Badge>
            </CardTitle>
            <Button variant="primary" size="sm" onClick={() => setShowAddCreator(!showAddCreator)}>
              <UserPlus className="w-3.5 h-3.5" /> Add Creator
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add Creator Form */}
          {showAddCreator && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-cyan-300">New Creator</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input placeholder="Handle (e.g. squidboycally)" value={newCreatorHandle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCreatorHandle(e.target.value)} className="text-sm" />
                <select value={newCreatorPlatform} onChange={(e) => setNewCreatorPlatform(e.target.value)}
                  className="rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 px-3 py-2 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 outline-none">
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                </select>
                <Input placeholder="Profile URL" value={newCreatorUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCreatorUrl(e.target.value)} className="text-sm" />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={addCreator} loading={saving} disabled={!newCreatorHandle.trim() || !newCreatorUrl.trim()}>
                  <UserPlus className="w-3.5 h-3.5" /> Add Creator
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddCreator(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Creator List */}
          {creators.length === 0 && !loading ? (
            <div className="text-center py-8">
              <Music className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No creators yet</p>
              <p className="text-xs text-zinc-600">Add TikTok, Facebook, or Instagram creators to source dance content</p>
            </div>
          ) : (
            <div className="space-y-2">
              {creators.map((creator) => (
                <div key={creator.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  creator.active
                    ? "border-white/[0.08] bg-white/[0.02] hover:border-cyan-500/20 hover:bg-cyan-500/[0.02]"
                    : "border-white/[0.04] bg-white/[0.01] opacity-40"
                }`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-cyan-400">@</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-200">@{creator.handle}</span>
                      <Badge variant={creator.platform === "tiktok" ? "violet" : creator.platform === "facebook" ? "cyan" : "amber"} className="text-[9px]">
                        {creator.platform}
                      </Badge>
                      {creator.verified && <Badge variant="emerald" className="text-[9px]">Verified</Badge>}
                    </div>
                    <a href={creator.profile_url} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-zinc-500 hover:text-cyan-400 truncate flex items-center gap-1 transition-colors">
                      {creator.profile_url.replace(/https?:\/\/(www\.)?/, "").slice(0, 40)}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                  <button
                    onClick={() => toggleCreator(creator.id, creator.active)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      creator.active
                        ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                        : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    }`}
                  >
                    {creator.active ? "Disable" : "Enable"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
