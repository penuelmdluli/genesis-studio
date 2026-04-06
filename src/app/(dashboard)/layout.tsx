"use client";

import { useEffect, useCallback, useRef } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/ui/command-palette";
import { CreditPurchaseModal } from "@/components/credit-purchase-modal";
import { LowCreditBanner } from "@/components/low-credit-banner";
import { OnboardingTour } from "@/components/onboarding/tour";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import { GenerationJob } from "@/types";

function mapVideo(v: Record<string, unknown>) {
  return {
    id: v.id as string,
    userId: v.user_id as string,
    jobId: v.job_id as string,
    title: v.title as string,
    url: v.url as string,
    thumbnailUrl: (v.thumbnail_url || "") as string,
    modelId: v.model_id as string,
    prompt: v.prompt as string,
    resolution: v.resolution as string,
    duration: v.duration as number,
    fps: v.fps as number,
    fileSize: (v.file_size || 0) as number,
    isPublic: (v.is_public || false) as boolean,
    aspectRatio: (v.aspect_ratio || "landscape") as string,
    audioUrl: (v.audio_url || undefined) as string | undefined,
    audioTrackId: (v.audio_track_id || undefined) as string | undefined,
    createdAt: v.created_at as string,
  };
}

function mapJob(j: Record<string, unknown>): GenerationJob {
  return {
    id: j.id as string,
    userId: j.user_id as string,
    status: j.status as GenerationJob["status"],
    type: j.type as GenerationJob["type"],
    modelId: j.model_id as GenerationJob["modelId"],
    prompt: j.prompt as string,
    negativePrompt: (j.negative_prompt || undefined) as string | undefined,
    inputImageUrl: (j.input_image_url || undefined) as string | undefined,
    inputVideoUrl: (j.input_video_url || undefined) as string | undefined,
    resolution: j.resolution as string,
    duration: j.duration as number,
    fps: j.fps as number,
    seed: (j.seed || undefined) as number | undefined,
    guidanceScale: (j.guidance_scale || undefined) as number | undefined,
    numInferenceSteps: (j.num_inference_steps || undefined) as number | undefined,
    isDraft: (j.is_draft || false) as boolean,
    aspectRatio: (j.aspect_ratio || undefined) as GenerationJob["aspectRatio"],
    audioTrackId: (j.audio_track_id || undefined) as string | undefined,
    audioUrl: (j.audio_url || undefined) as string | undefined,
    creditsCost: j.credits_cost as number,
    outputVideoUrl: (j.output_video_url || undefined) as string | undefined,
    thumbnailUrl: (j.thumbnail_url || undefined) as string | undefined,
    runpodJobId: (j.runpod_job_id || undefined) as string | undefined,
    gpuTime: (j.gpu_time || undefined) as number | undefined,
    errorMessage: (j.error_message || undefined) as string | undefined,
    progress: (j.progress || 0) as number,
    createdAt: j.created_at as string,
    startedAt: (j.started_at || undefined) as string | undefined,
    completedAt: (j.completed_at || undefined) as string | undefined,
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen, setUser, setVideos, setActiveJobs, updateJob, addVideo } = useStore();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch active jobs and poll for updates
  const pollActiveJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs?status=queued&limit=50");
      if (!res.ok) return;
      const { jobs: queuedJobs } = await res.json();

      const res2 = await fetch("/api/jobs?status=processing&limit=50");
      if (!res2.ok) return;
      const { jobs: processingJobs } = await res2.json();

      const allActive = [...(queuedJobs || []), ...(processingJobs || [])].map(mapJob);
      setActiveJobs(allActive);

      // If there are active jobs, poll each one for progress via their individual endpoint
      for (const job of allActive) {
        try {
          const jobRes = await fetch(`/api/jobs/${job.id}`);
          if (jobRes.ok) {
            const jobData = await jobRes.json();
            updateJob(job.id, {
              status: jobData.status,
              progress: jobData.progress || 0,
              outputVideoUrl: jobData.outputVideoUrl || undefined,
              thumbnailUrl: jobData.thumbnailUrl || undefined,
              errorMessage: jobData.errorMessage || undefined,
            });

            // If job just completed, refresh videos
            if (jobData.status === "completed" && jobData.outputVideoUrl) {
              const videosRes = await fetch("/api/videos");
              if (videosRes.ok) {
                const videosData = await videosRes.json();
                setVideos((videosData.videos || []).map(mapVideo));
              }
            }
          }
        } catch {
          // Individual job poll failure is ok, continue
        }
      }

      // Return count so we know if we should keep polling
      return allActive.length;
    } catch (err) {
      console.error("Failed to poll jobs:", err);
      return 0;
    }
  }, [setActiveJobs, updateJob, setVideos]);

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, videosRes, jobsQueuedRes, jobsProcessingRes] = await Promise.all([
          fetch("/api/user"),
          fetch("/api/videos"),
          fetch("/api/jobs?status=queued&limit=50"),
          fetch("/api/jobs?status=processing&limit=50"),
        ]);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          setVideos((videosData.videos || []).map(mapVideo));
        }

        // Load active jobs
        const activeJobs: GenerationJob[] = [];
        if (jobsQueuedRes.ok) {
          const { jobs } = await jobsQueuedRes.json();
          activeJobs.push(...(jobs || []).map(mapJob));
        }
        if (jobsProcessingRes.ok) {
          const { jobs } = await jobsProcessingRes.json();
          activeJobs.push(...(jobs || []).map(mapJob));
        }
        setActiveJobs(activeJobs);

        // Start polling if there are active jobs
        if (activeJobs.length > 0) {
          pollingRef.current = setInterval(async () => {
            const count = await pollActiveJobs();
            if (count === 0 && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              // Final refresh of videos
              const finalVideos = await fetch("/api/videos");
              if (finalVideos.ok) {
                const data = await finalVideos.json();
                setVideos((data.videos || []).map(mapVideo));
              }
            }
          }, 5000);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    }
    loadData();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [setUser, setVideos, setActiveJobs, pollActiveJobs]);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Sidebar />
      <CommandPalette />
      <CreditPurchaseModal />
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          // Mobile: no margin (sidebar is overlay), Desktop: margin based on sidebar state
          "ml-0 md:ml-16",
          sidebarOpen && "md:ml-64"
        )}
      >
        <OnboardingTour />
        <LowCreditBanner />
        {/* Mobile: smaller padding + top padding for hamburger, Desktop: normal padding */}
        <div className="px-4 pt-16 pb-6 md:p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
