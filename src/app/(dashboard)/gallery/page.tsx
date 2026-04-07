"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { VideoPlayer } from "@/components/ui/video-player";
import { PageTransition, StaggerGroup, StaggerItem, motion } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { GenesisLoader } from "@/components/ui/genesis-loader";
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
  ArrowUpDown,
  Wand2,
  ArrowUpRight,
  Volume2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

type SortKey = "newest" | "oldest" | "name";
type FormatFilter = "all" | "standard" | "reel" | "audio";

export default function GalleryPage() {
  const { videos, activeJobs, removeVideo, isInitialized } = useStore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [filterFormat, setFilterFormat] = useState<FormatFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredVideos = (videos || [])
    .filter((v) => {
      const matchesSearch =
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.prompt.toLowerCase().includes(search.toLowerCase());
      const matchesFormat =
        filterFormat === "all" ||
        (filterFormat === "reel" && v.aspectRatio === "portrait") ||
        (filterFormat === "standard" && v.aspectRatio !== "portrait") ||
        (filterFormat === "audio" && v.audioUrl);
      return matchesSearch && matchesFormat;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.title.localeCompare(b.title);
    });

  const pendingJobs = (activeJobs || []).filter(
    (j) => j.status === "queued" || j.status === "processing"
  );

  const currentVideo = (videos || []).find((v) => v.id === selectedVideo);

  // Total duration for stats
  const totalDuration = (videos || []).reduce((sum, v) => sum + (v.duration || 0), 0);

  const handleDownload = async (e: React.MouseEvent, url: string, title: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast("Download started", "success");
    } catch {
      // Fallback: open in new tab for manual download
      window.open(url, "_blank");
      toast("Opening video in new tab for download", "info");
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(videoId);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/videos/${confirmDeleteId}`, { method: "DELETE" });
      if (res.ok) {
        removeVideo(confirmDeleteId);
        if (selectedVideo === confirmDeleteId) setSelectedVideo(null);
        toast("Video deleted", "success");
      } else {
        const data = await res.json();
        toast(data.error || "Failed to delete video", "error");
      }
    } catch {
      toast("Failed to delete video", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Gallery</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {(videos || []).length} video{(videos || []).length !== 1 ? "s" : ""}
            {totalDuration > 0 && <> &middot; {totalDuration}s total footage</>}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filters — scrollable on mobile */}
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] p-0.5 bg-white/[0.02] overflow-x-auto flex-1 sm:flex-none">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "standard", label: "Standard" },
                  { key: "reel", label: "Reels" },
                  { key: "audio", label: "Audio" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterFormat(f.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    filterFormat === f.key
                      ? "bg-violet-500/15 text-violet-300 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <button
              onClick={() => {
                const order: SortKey[] = ["newest", "oldest", "name"];
                setSortBy(order[(order.indexOf(sortBy) + 1) % order.length]);
              }}
              className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
              title={`Sort: ${sortBy}`}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* View mode — hidden on small mobile */}
            <div className="hidden sm:flex rounded-lg border border-white/[0.06] overflow-hidden bg-white/[0.02]">
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
      </div>

      {/* Pending Jobs — Premium Progress */}
      {pendingJobs.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-[#111118] to-fuchsia-950/20">
          {/* Animated shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/[0.03] to-transparent animate-shimmer" />
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-violet-500" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-violet-500 animate-ping" />
              </div>
              <span className="text-sm font-medium text-violet-300">
                {pendingJobs.length} generation{pendingJobs.length > 1 ? "s" : ""} in progress
              </span>
            </div>
            <div className="space-y-3">
              {pendingJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate font-medium">
                        &ldquo;{job.prompt}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Badge variant={job.status === "processing" ? "amber" : "default"} className="text-[10px]">
                          {job.status === "processing" ? "Generating..." : "In Queue"}
                        </Badge>
                        <span className="text-[11px] text-zinc-600">
                          AI Video &middot; {job.duration || 5}s
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      initial={{ width: "5%" }}
                      animate={{
                        width: job.progress > 0 ? `${job.progress}%` : job.status === "processing" ? "60%" : "15%",
                      }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading State — show skeleton while data is fetching */}
      {!isInitialized ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <GenesisLoader size="sm" text="Loading gallery..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full mt-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-video rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-24 relative">
          <div className="absolute inset-0 bg-glow-center opacity-20" />
          <div className="relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <Film className="w-9 h-9 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-300 mb-2">
              {search || filterFormat !== "all" ? "No videos match your filters" : "Your gallery is empty"}
            </h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
              {search || filterFormat !== "all"
                ? "Try adjusting your search or filters."
                : "Create your first AI video and it will appear here."}
            </p>
            {!search && filterFormat === "all" && (
              <a href="/generate">
                <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-600/20">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Your First Video
                </Button>
              </a>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* ====== GRID VIEW — Netflix-style hover-to-play ====== */
        <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <StaggerItem key={video.id}>
              <VideoCard
                video={video}
                isDeleting={deletingId === video.id}
                onSelect={() => setSelectedVideo(video.id)}
                onDownload={handleDownload}
                onDelete={handleDeleteClick}
              />
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        /* ====== LIST VIEW ====== */
        <div className="space-y-2">
          {filteredVideos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
              className="flex items-center gap-4 p-3 rounded-xl border border-white/[0.06] bg-[#111118]/40 hover:bg-[#111118]/80 hover:border-white/[0.1] transition-all duration-200 cursor-pointer group"
              onClick={() => setSelectedVideo(video.id)}
            >
              <div className="w-28 h-16 rounded-lg bg-[#0D0D14] overflow-hidden shrink-0 relative">
                {video.url ? (
                  <video
                    src={`${video.url}#t=0.1`}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-5 h-5 text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
                <div className="absolute bottom-1 right-1">
                  <span className="px-1 py-0.5 rounded text-[9px] bg-black/70 text-white font-medium">
                    {formatDuration(video.duration)}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{video.title}</p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{video.prompt}</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="hidden sm:inline-flex">{video.aspectRatio === "portrait" && <Badge variant="cyan" className="text-[10px]">Reel</Badge>}</span>
                <span className="hidden sm:inline-flex">{video.audioUrl && <Badge variant="violet" className="text-[10px]"><Volume2 className="w-2.5 h-2.5 mr-1" />Audio</Badge>}</span>
                <Badge className="text-[10px]">{video.resolution}</Badge>
                <span className="text-xs text-zinc-600 hidden sm:inline">{formatRelativeTime(video.createdAt)}</span>
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

      {/* ====== Premium Video Player Modal ====== */}
      {currentVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-8 animate-fade-in"
          onClick={() => setSelectedVideo(null)}
        >
          <motion.div
            className="relative w-full max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-0"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute top-0 right-0 sm:-top-12 sm:right-0 z-20 p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10 bg-black/50 sm:bg-transparent"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video Player */}
            <div className={`rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ${currentVideo.aspectRatio === "portrait" ? "max-w-sm mx-auto" : ""}`}>
              <VideoPlayer
                src={currentVideo.url}
                poster={currentVideo.thumbnailUrl}
                audioSrc={currentVideo.audioUrl}
                title={currentVideo.title}
                autoPlay
                className={currentVideo.aspectRatio === "portrait" ? "aspect-[9/16]" : "aspect-video"}
              />
            </div>

            {/* Video Details */}
            <div className="mt-5">
              <h3 className="text-lg font-semibold text-white">{currentVideo.title}</h3>
              <p className="text-sm text-white/50 mt-1 line-clamp-2">{currentVideo.prompt}</p>

              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-white/40">
                <span>{currentVideo.resolution}</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span>{formatDuration(currentVideo.duration)}</span>
                {currentVideo.audioUrl && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="flex items-center gap-1 text-violet-300">
                      <Volume2 className="w-3 h-3" /> Audio
                    </span>
                  </>
                )}
                {currentVideo.aspectRatio === "portrait" && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="flex items-center gap-1 text-cyan-300">
                      <Smartphone className="w-3 h-3" /> Reel
                    </span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span>{formatRelativeTime(currentVideo.createdAt)}</span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-5">
                <button
                  onClick={(e) => handleDownload(e, currentVideo.url, currentVideo.title)}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 active:scale-95 shadow-lg shadow-violet-600/20"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <a
                  href="/generate"
                  className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white/80 text-sm font-medium transition-all duration-200 flex items-center gap-2 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </a>
                <a
                  href="/upscale"
                  className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white/80 text-sm font-medium transition-all duration-200 flex items-center gap-2 active:scale-95"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Upscale
                </a>
                <a
                  href="/brain"
                  className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white/80 text-sm font-medium transition-all duration-200 flex items-center gap-2 active:scale-95"
                >
                  <Wand2 className="w-4 h-4" />
                  Brain Studio
                </a>
                <button
                  onClick={() => setConfirmDeleteId(currentVideo.id)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-red-500/20 text-white/40 hover:text-red-400 text-sm font-medium transition-all duration-200 flex items-center gap-2 active:scale-95 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <Modal
          open={!!confirmDeleteId}
          onClose={() => setConfirmDeleteId(null)}
          size="sm"
        >
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Delete Video?</h3>
            <p className="text-sm text-zinc-400 mb-6 max-w-xs mx-auto">
              This will permanently delete the video. This cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                onClick={handleDeleteConfirm}
              >
                <Trash2 className="w-4 h-4" /> Delete Forever
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Shimmer animation style */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </PageTransition>
  );
}

/* ================================================
   VideoCard — Netflix-style hover-to-play component
   ================================================ */
function VideoCard({
  video,
  isDeleting,
  onSelect,
  onDownload,
  onDelete,
}: {
  video: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    title: string;
    prompt: string;
    duration: number;
    resolution: string;
    aspectRatio?: string;
    audioUrl?: string;
    createdAt: string;
    modelId?: string;
  };
  isDeleting: boolean;
  onSelect: () => void;
  onDownload: (e: React.MouseEvent, url: string, title: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // IntersectionObserver — only load video when near viewport (200px ahead)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  const isPortrait = video.aspectRatio === "portrait";

  return (
    <motion.div
      ref={containerRef}
      className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
        isDeleting ? "opacity-50 pointer-events-none" : ""
      }`}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      whileHover={{
        scale: 1.03,
        boxShadow: "0 8px 40px rgba(139, 92, 246, 0.15)",
      }}
      transition={{ duration: 0.25 }}
      layout
    >
      {/* Video container — always aspect-video for uniform grid */}
      <div className="aspect-video bg-[#0D0D14] relative overflow-hidden">
        {/* Poster thumbnail — loads instantly, blurs out when video plays */}
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 z-[2] ${
              videoLoaded && isHovered ? "opacity-0 scale-105 blur-sm" : "opacity-100"
            }`}
          />
        )}

        {/* Shimmer skeleton while no thumbnail and video not loaded */}
        {!video.thumbnailUrl && !videoLoaded && (
          <div className="absolute inset-0 z-[5]">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/15 via-[#0D0D14] to-fuchsia-900/10" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_2s_infinite]" />
            </div>
          </div>
        )}

        {/* Loading spinner on hover while video loads */}
        {isVisible && isHovered && !videoLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-[6]">
            <GenesisLoader size="md" />
          </div>
        )}

        {/* Video element — only mounted when near viewport (saves bandwidth) */}
        {isVisible && video.url ? (
          <video
            ref={videoRef}
            src={`${video.url}#t=0.5`}
            className={`w-full h-full ${isPortrait ? "object-contain" : "object-cover"} transition-all duration-500 ${
              isHovered ? "scale-105" : "scale-100"
            }`}
            muted
            loop
            playsInline
            preload="none"
            onLoadedData={() => setVideoLoaded(true)}
          />
        ) : !isVisible && !video.thumbnailUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/10 to-transparent">
            <Film className="w-8 h-8 text-zinc-800" />
          </div>
        ) : null}

        {/* Bottom gradient — always visible */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Hover overlay with actions */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 transition-opacity duration-300 ${
          isHovered ? "opacity-100" : "opacity-0"
        } flex flex-col justify-between p-3 z-10`}>
          {/* Top right actions */}
          <div className="flex justify-end">
            <div className="flex gap-1.5">
              <button
                className="p-2 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/70 transition-all duration-200 active:scale-90"
                onClick={(e) => onDownload(e, video.url, video.title)}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-2 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 hover:text-red-400 hover:bg-black/70 transition-all duration-200 active:scale-90"
                onClick={(e) => onDelete(e, video.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center play button */}
          <div className="flex items-center justify-center flex-1">
            <motion.div
              className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isHovered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
            </motion.div>
          </div>

          <div />
        </div>

        {/* Duration badge — bottom right, always visible */}
        <div className="absolute bottom-2 right-2 z-20">
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/70 text-white backdrop-blur-sm">
            {formatDuration(video.duration)}
          </span>
        </div>

        {/* Badges — bottom left */}
        <div className="absolute bottom-2 left-2 flex gap-1 z-20">
          {video.aspectRatio === "portrait" && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/80 text-white backdrop-blur-sm">
              Reel
            </span>
          )}
          {video.audioUrl && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-violet-500/80 text-white backdrop-blur-sm flex items-center gap-0.5">
              <Volume2 className="w-2.5 h-2.5" /> Audio
            </span>
          )}
        </div>

        {/* Resolution badge — top left */}
        {video.resolution && (
          <div className={`absolute top-2 left-2 z-20 transition-opacity duration-300 ${isHovered ? "opacity-0" : "opacity-100"}`}>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-black/50 text-white/70 backdrop-blur-sm uppercase">
              {video.resolution}
            </span>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3 bg-[#111118]/80 border-t border-white/[0.04]">
        <p className="text-sm font-medium text-zinc-200 truncate">{video.title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-zinc-600">
            {formatRelativeTime(video.createdAt)}
          </span>
          <span className="text-[11px] text-zinc-600">{video.resolution}</span>
        </div>
      </div>

      {/* Hover ring effect */}
      <div className={`absolute inset-0 rounded-xl border-2 transition-all duration-300 pointer-events-none ${
        isHovered ? "border-violet-500/40 shadow-lg shadow-violet-500/10" : "border-white/[0.06]"
      }`} />
    </motion.div>
  );
}
