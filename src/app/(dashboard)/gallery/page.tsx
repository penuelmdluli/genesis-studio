"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SkeletonVideoCard } from "@/components/ui/skeleton";
import { PageTransition, StaggerGroup, StaggerItem, MotionSection, motion } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  Film,
  Search,
  Download,
  Trash2,
  Play,
  Grid3x3,
  List,
  Clock,
  Smartphone,
  Music,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

type SortKey = "newest" | "oldest" | "name";

export default function GalleryPage() {
  const { videos, activeJobs, removeVideo } = useStore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [filterFormat, setFilterFormat] = useState<"all" | "standard" | "reel">("all");
  const isLoading = !videos;

  const filteredVideos = videos
    .filter((v) => {
      const matchesSearch =
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.prompt.toLowerCase().includes(search.toLowerCase());
      const matchesFormat =
        filterFormat === "all" ||
        (filterFormat === "reel" && v.aspectRatio === "portrait") ||
        (filterFormat === "standard" && v.aspectRatio !== "portrait");
      return matchesSearch && matchesFormat;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.title.localeCompare(b.title);
    });

  const pendingJobs = activeJobs.filter(
    (j) => j.status === "queued" || j.status === "processing"
  );

  const currentVideo = videos.find((v) => v.id === selectedVideo);

  const handleDownload = (e: React.MouseEvent, url: string, title: string) => {
    e.stopPropagation();
    window.open(url, "_blank");
    toast("Download started", "success");
  };

  const handleDelete = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    removeVideo(videoId);
    toast("Video removed", "info");
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Gallery</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {videos.length} video{videos.length !== 1 ? "s" : ""} in your library
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] p-0.5 bg-white/[0.02]">
            {(["all", "standard", "reel"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterFormat(f)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterFormat === f
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {f === "all" ? "All" : f === "reel" ? "Reels" : "Standard"}
              </button>
            ))}
          </div>

          {/* Sort */}
          <button
            onClick={() => {
              const order: SortKey[] = ["newest", "oldest", "name"];
              setSortBy(order[(order.indexOf(sortBy) + 1) % order.length]);
            }}
            className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 transition-colors"
            title={`Sort: ${sortBy}`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {/* View mode */}
          <div className="flex rounded-lg border border-white/[0.06] overflow-hidden bg-white/[0.02]">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-violet-500/15 text-violet-300" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-violet-500/15 text-violet-300" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Pending Jobs */}
      {pendingJobs.length > 0 && (
        <Card className="border-amber-500/15 bg-gradient-to-r from-amber-500/[0.04] to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Clock className="w-3 h-3 text-amber-400" />
              </div>
              <span className="text-sm font-medium text-amber-300">
                {pendingJobs.length} generation{pendingJobs.length > 1 ? "s" : ""} in progress
              </span>
            </div>
            <div className="space-y-2">
              {pendingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
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
        <div className="text-center py-24 relative">
          <div className="absolute inset-0 bg-glow-center opacity-20" />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <Film className="w-7 h-7 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-2">
              {search || filterFormat !== "all" ? "No videos match your filters" : "No videos yet"}
            </h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
              {search || filterFormat !== "all"
                ? "Try adjusting your search or filters."
                : "Generate your first video to see it here."}
            </p>
            {!search && filterFormat === "all" && (
              <a href="/generate">
                <Button variant="outline">Generate Your First Video</Button>
              </a>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <StaggerItem key={video.id}>
              <motion.div
                className="group relative rounded-xl border border-white/[0.06] bg-[#111118]/60 overflow-hidden cursor-pointer"
                onClick={() => setSelectedVideo(video.id)}
                whileHover={{ y: -3, boxShadow: "0 0 40px rgba(139, 92, 246, 0.12)" }}
                transition={{ duration: 0.2 }}
                layout
              >
                <div className={`${video.aspectRatio === "portrait" ? "aspect-[9/16]" : "aspect-video"} bg-[#0D0D14] relative overflow-hidden`}>
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/10 to-transparent">
                      <Film className="w-8 h-8 text-zinc-800" />
                    </div>
                  )}

                  {/* Video hover preview */}
                  {video.url && (
                    <video
                      src={video.url}
                      className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        el.currentTime = 0;
                        el.play().catch(() => {});
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                      }}
                    />
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-3 z-10">
                    <div className="flex justify-end">
                      <div className="flex gap-1">
                        <button
                          className="p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-white hover:bg-black/80 transition-colors"
                          onClick={(e) => handleDownload(e, video.url, video.title)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-red-400 hover:bg-black/80 transition-colors"
                          onClick={(e) => handleDelete(e, video.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center flex-1">
                      <motion.div
                        className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="absolute bottom-2 left-2 flex gap-1 z-10">
                    {video.aspectRatio === "portrait" && (
                      <Badge variant="cyan" className="text-[10px]">Reel</Badge>
                    )}
                    {video.audioUrl && (
                      <Badge variant="violet" className="text-[10px]">
                        <Music className="w-2.5 h-2.5" />
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 z-10">
                    <Badge className="text-[10px]">{video.resolution}</Badge>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-zinc-200 truncate">{video.title}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-zinc-600">
                      {formatRelativeTime(video.createdAt)}
                    </span>
                    <span className="text-xs text-zinc-600">{formatDuration(video.duration)}</span>
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <div className="space-y-2">
          {filteredVideos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
              className="flex items-center gap-4 p-3 rounded-xl border border-white/[0.06] bg-[#111118]/40 hover:bg-[#111118]/80 hover:border-white/[0.1] transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedVideo(video.id)}
            >
              <div className="w-24 h-14 rounded-lg bg-[#0D0D14] overflow-hidden shrink-0 relative group">
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-5 h-5 text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{video.title}</p>
                <p className="text-xs text-zinc-500 truncate">{video.prompt}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {video.aspectRatio === "portrait" && <Badge variant="cyan" className="text-[10px]">Reel</Badge>}
                <Badge>{video.resolution}</Badge>
                <span className="text-xs text-zinc-500">{formatDuration(video.duration)}</span>
                <span className="text-xs text-zinc-600">{formatRelativeTime(video.createdAt)}</span>
                <button
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
                  onClick={(e) => handleDownload(e, video.url, video.title)}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {currentVideo && (
        <Modal
          open={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          size={currentVideo.aspectRatio === "portrait" ? "sm" : "full"}
        >
          <div className={currentVideo.aspectRatio === "portrait" ? "aspect-[9/16]" : "aspect-video"} style={{ background: "black", borderRadius: "12px", overflow: "hidden", position: "relative" }}>
            <video
              src={currentVideo.url}
              controls
              autoPlay
              className="w-full h-full"
            />
            {currentVideo.audioUrl && (
              <audio
                src={currentVideo.audioUrl}
                autoPlay
                loop
                muted={audioMuted}
              />
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200 truncate">{currentVideo.title}</p>
              <p className="text-xs text-zinc-500 truncate mt-0.5">{currentVideo.prompt}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              {currentVideo.aspectRatio === "portrait" && (
                <Badge variant="cyan"><Smartphone className="w-3 h-3 mr-1" /> Reel</Badge>
              )}
              <Badge>{currentVideo.resolution}</Badge>
              {currentVideo.audioUrl && (
                <button
                  onClick={() => setAudioMuted(!audioMuted)}
                  className="p-1.5 rounded-lg border border-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </PageTransition>
  );
}
