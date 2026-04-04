"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import {
  Film,
  Search,
  Download,
  Trash2,
  Share2,
  Play,
  MoreVertical,
  Grid3x3,
  List,
  Clock,
} from "lucide-react";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

export default function GalleryPage() {
  const { videos, activeJobs, removeVideo } = useStore();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const filteredVideos = videos.filter(
    (v) =>
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.prompt.toLowerCase().includes(search.toLowerCase())
  );

  const pendingJobs = activeJobs.filter(
    (j) => j.status === "queued" || j.status === "processing"
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Gallery</h1>
          <p className="text-sm text-zinc-500 mt-1">
            All your generated videos in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Pending Jobs */}
      {pendingJobs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-sm font-medium text-amber-300">
                {pendingJobs.length} generation{pendingJobs.length > 1 ? "s" : ""} in progress
              </span>
            </div>
            <div className="space-y-2">
              {pendingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/30"
                >
                  <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center">
                    <Play className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{job.prompt}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={job.status === "processing" ? "amber" : "default"}>
                        {job.status}
                      </Badge>
                      {job.progress > 0 && (
                        <span className="text-xs text-zinc-500">{job.progress}%</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Videos */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-20">
          <Film className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400 mb-2">
            {search ? "No videos match your search" : "No videos yet"}
          </h3>
          <p className="text-sm text-zinc-500">
            {search ? "Try a different search term." : "Generate your first video to see it here."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="group relative rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden hover:border-violet-500/30 transition-all cursor-pointer"
              onClick={() => setSelectedVideo(selectedVideo === video.id ? null : video.id)}
            >
              <div className="aspect-video bg-zinc-800 relative">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-8 h-8 text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-10 h-10 text-white" />
                </div>
                <div className="absolute bottom-2 right-2">
                  <Badge className="text-[10px]">{video.resolution}</Badge>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-zinc-200 truncate">{video.title}</p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{video.prompt}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-zinc-600">
                    {formatRelativeTime(video.createdAt)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(video.url, "_blank");
                      }}
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeVideo(video.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-4 p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
            >
              <div className="w-24 h-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-5 h-5 text-zinc-700" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{video.title}</p>
                <p className="text-xs text-zinc-500 truncate">{video.prompt}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge>{video.resolution}</Badge>
                <span className="text-xs text-zinc-500">{formatDuration(video.duration)}</span>
                <span className="text-xs text-zinc-600">{formatRelativeTime(video.createdAt)}</span>
                <Button variant="ghost" size="sm">
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="max-w-4xl w-full rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video bg-black">
              <video
                src={videos.find((v) => v.id === selectedVideo)?.url}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-zinc-200">
                {videos.find((v) => v.id === selectedVideo)?.title}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {videos.find((v) => v.id === selectedVideo)?.prompt}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
