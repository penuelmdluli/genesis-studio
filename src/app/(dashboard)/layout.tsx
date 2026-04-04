"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/ui/command-palette";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen, setUser, setVideos } = useStore();

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, videosRes] = await Promise.all([
          fetch("/api/user"),
          fetch("/api/videos"),
        ]);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          setVideos(
            (videosData.videos || []).map((v: Record<string, unknown>) => ({
              id: v.id,
              userId: v.user_id,
              jobId: v.job_id,
              title: v.title,
              url: v.url,
              thumbnailUrl: v.thumbnail_url || "",
              modelId: v.model_id,
              prompt: v.prompt,
              resolution: v.resolution,
              duration: v.duration,
              fps: v.fps,
              fileSize: v.file_size || 0,
              isPublic: v.is_public || false,
              aspectRatio: v.aspect_ratio || "landscape",
              audioUrl: v.audio_url || undefined,
              audioTrackId: v.audio_track_id || undefined,
              createdAt: v.created_at,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    }
    loadData();
  }, [setUser, setVideos]);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Sidebar />
      <CommandPalette />
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
