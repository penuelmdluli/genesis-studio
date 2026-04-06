"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import {
  Scissors,
  Merge,
  Crop,
  Music,
  Type,
  Upload,
  Play,
  Download,
  X,
  Film,
} from "lucide-react";

type EditMode = "trim" | "merge" | "crop" | "music" | "text";

const EDIT_MODES: { value: EditMode; label: string; icon: typeof Scissors; desc: string }[] = [
  { value: "trim", label: "Trim", icon: Scissors, desc: "Cut start/end of video" },
  { value: "merge", label: "Merge", icon: Merge, desc: "Combine multiple clips" },
  { value: "crop", label: "Crop", icon: Crop, desc: "Resize & reframe" },
  { value: "music", label: "Music", icon: Music, desc: "Add background audio" },
  { value: "text", label: "Text", icon: Type, desc: "Add text overlay" },
];

const CROP_PRESETS = [
  { label: "16:9 (YouTube)", width: 16, height: 9 },
  { label: "9:16 (TikTok)", width: 9, height: 16 },
  { label: "1:1 (Instagram)", width: 1, height: 1 },
  { label: "4:5 (Instagram)", width: 4, height: 5 },
  { label: "4:3 (Standard)", width: 4, height: 3 },
];

export default function EditPage() {
  const { videos } = useStore();
  const { toast } = useToast();
  const [mode, setMode] = useState<EditMode>("trim");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Text overlay state
  const [overlayText, setOverlayText] = useState("");
  const [textPosition, setTextPosition] = useState<"top" | "center" | "bottom">("bottom");

  // Selected video
  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  const handleVideoSelect = (videoId: string) => {
    setSelectedVideoId(videoId);
    const video = videos.find((v) => v.id === videoId);
    if (video) {
      setTrimEnd(video.duration);
    }
  };

  const handleExport = async () => {
    if (!selectedVideoId) {
      toast("Select a video first", "error");
      return;
    }

    const editConfig = {
      videoId: selectedVideoId,
      mode,
      ...(mode === "trim" && { trimStart, trimEnd }),
      ...(mode === "crop" && { cropPreset: "16:9" }),
      ...(mode === "text" && { overlayText, textPosition }),
    };

    toast(
      "Video editing is being prepared. This feature requires FFmpeg processing — coming in the next update!",
      "info"
    );
  };

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Film className="w-6 h-6 text-violet-400" />
          Video Editor
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Trim, merge, crop, add music, and text overlays to your videos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Edit Modes */}
        <div className="space-y-2">
          {EDIT_MODES.map((m) => {
            const isActive = mode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <m.icon className={`w-4 h-4 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
                  <span className={`text-sm font-medium ${isActive ? "text-violet-300" : "text-zinc-300"}`}>
                    {m.label}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 ml-6">{m.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Preview */}
          <Card>
            <CardContent className="p-4">
              {selectedVideo ? (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    src={selectedVideo.url}
                    controls
                    className="w-full rounded-xl bg-black"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{selectedVideo.title}</span>
                    <span className="text-xs text-zinc-500">{selectedVideo.duration}s · {selectedVideo.resolution}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Upload className="w-10 h-10 text-zinc-600 mb-3" />
                  <p className="text-sm text-zinc-400">Select a video from your gallery to start editing</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mode-specific controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{EDIT_MODES.find((m) => m.value === mode)?.label} Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mode === "trim" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Start (seconds)</label>
                      <Input
                        type="number"
                        min={0}
                        max={trimEnd}
                        value={trimStart}
                        onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">End (seconds)</label>
                      <Input
                        type="number"
                        min={trimStart}
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Output duration: {Math.max(0, trimEnd - trimStart).toFixed(1)}s
                  </p>
                </div>
              )}

              {mode === "crop" && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Crop Preset</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CROP_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30 text-sm text-zinc-300 transition-all text-left"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "text" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Text</label>
                    <Input
                      placeholder="Enter overlay text..."
                      value={overlayText}
                      onChange={(e) => setOverlayText(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Position</label>
                    <div className="flex gap-2">
                      {(["top", "center", "bottom"] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setTextPosition(pos)}
                          className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all ${
                            textPosition === pos
                              ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                              : "bg-white/[0.03] text-zinc-500 border border-white/[0.06]"
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mode === "music" && (
                <p className="text-sm text-zinc-400">
                  Select a track from the built-in library to add as background music. Audio mixing will be processed server-side.
                </p>
              )}

              {mode === "merge" && (
                <p className="text-sm text-zinc-400">
                  Select multiple videos from the gallery panel to merge them into a single clip. Videos will be concatenated in order.
                </p>
              )}

              <Button
                className="w-full"
                onClick={handleExport}
                disabled={!selectedVideoId}
              >
                <Download className="w-4 h-4" /> Export Edited Video
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Video Gallery Picker — hidden on mobile, shown on desktop */}
        <div className="hidden lg:block space-y-2">
          <h3 className="text-sm font-medium text-zinc-300 px-1">Your Videos</h3>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {videos.length === 0 ? (
              <p className="text-xs text-zinc-500 p-3">No videos yet. Generate some first!</p>
            ) : (
              videos.slice(0, 20).map((video) => {
                const isSelected = selectedVideoId === video.id;
                return (
                  <button
                    key={video.id}
                    onClick={() => handleVideoSelect(video.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]"
                    }`}
                  >
                    <div className="w-16 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                      {video.thumbnailUrl && (
                        <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-zinc-300 truncate">{video.title}</div>
                      <div className="text-[10px] text-zinc-500">{video.duration}s · {video.resolution}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Fixed Export button at bottom */}
      <MobileActionBar>
        <Button
          className="w-full shadow-lg shadow-violet-600/20"
          disabled={!selectedVideoId}
          onClick={handleExport}
        >
          <Download className="w-4 h-4" /> Export Edited Video
        </Button>
      </MobileActionBar>

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
