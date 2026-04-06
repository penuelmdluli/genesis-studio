"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import {
  FolderOpen,
  Plus,
  Trash2,
  Edit3,
  X,
  Film,
} from "lucide-react";

interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  videoCount: number;
  createdAt: string;
}

export default function CollectionsPage() {
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      if (res.ok) {
        toast("Collection created!", "success");
        setNewName("");
        setNewDescription("");
        setShowCreate(false);
        fetchCollections();
      } else {
        toast("Failed to create collection", "error");
      }
    } catch {
      toast("Failed to create collection", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c.id !== id));
        toast("Collection deleted", "success");
      }
    } catch {
      toast("Failed to delete collection", "error");
    }
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-violet-400" />
            Collections
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Organize your videos into folders and collections.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4" /> New Collection
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Create Collection</label>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/[0.06] rounded-lg">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <Input
              placeholder="Collection name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <Button onClick={handleCreate} disabled={!newName.trim() || isCreating} loading={isCreating}>
              Create
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-zinc-300 mb-1">No collections yet</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Create your first collection to organize your generated videos.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> Create Collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card key={collection.id} className="group hover:border-violet-500/20 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${collection.color}20` }}
                  >
                    <FolderOpen className="w-5 h-5" style={{ color: collection.color }} />
                  </div>
                  <button
                    onClick={() => handleDelete(collection.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1">{collection.name}</h3>
                {collection.description && (
                  <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{collection.description}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Film className="w-3 h-3" />
                  {collection.videoCount} video{collection.videoCount !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
