// ============================================
// GENESIS STUDIO — Global State (Zustand)
// ============================================

import { create } from "zustand";
import { GenerationJob, Video, PlanId, ModelId, GenerationType, AspectRatio, VideoFormat } from "@/types";

interface UserState {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: PlanId;
  creditBalance: number;
  monthlyCreditsUsed: number;
  monthlyCreditsLimit: number;
}

interface GenerateFormState {
  type: GenerationType;
  modelId: ModelId;
  prompt: string;
  negativePrompt: string;
  resolution: string;
  duration: number;
  fps: number;
  seed?: number;
  guidanceScale: number;
  numInferenceSteps: number;
  isDraft: boolean;
  inputImage?: File;
  inputVideo?: File;
  videoFormat: VideoFormat;
  aspectRatio: AspectRatio;
  audioTrackId?: string;
  customAudio?: File;
}

interface StoreState {
  // User
  user: UserState | null;
  setUser: (user: UserState | null) => void;
  updateCreditBalance: (balance: number) => void;

  // Generation form
  form: GenerateFormState;
  setFormField: <K extends keyof GenerateFormState>(
    key: K,
    value: GenerateFormState[K]
  ) => void;
  resetForm: () => void;

  // Active jobs
  activeJobs: GenerationJob[];
  setActiveJobs: (jobs: GenerationJob[]) => void;
  updateJob: (jobId: string, updates: Partial<GenerationJob>) => void;
  addJob: (job: GenerationJob) => void;

  // Videos
  videos: Video[];
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;
  removeVideo: (videoId: string) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const defaultForm: GenerateFormState = {
  type: "t2v",
  modelId: "wan-2.2",
  prompt: "",
  negativePrompt: "",
  resolution: "720p",
  duration: 5,
  fps: 24,
  guidanceScale: 7.5,
  numInferenceSteps: 30,
  isDraft: false,
  videoFormat: "standard",
  aspectRatio: "landscape",
};

export const useStore = create<StoreState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),
  updateCreditBalance: (balance) =>
    set((state) => ({
      user: state.user ? { ...state.user, creditBalance: balance } : null,
    })),

  // Form
  form: { ...defaultForm },
  setFormField: (key, value) =>
    set((state) => ({ form: { ...state.form, [key]: value } })),
  resetForm: () => set({ form: { ...defaultForm } }),

  // Jobs
  activeJobs: [],
  setActiveJobs: (jobs) => set({ activeJobs: jobs }),
  updateJob: (jobId, updates) =>
    set((state) => ({
      activeJobs: state.activeJobs.map((j) =>
        j.id === jobId ? { ...j, ...updates } : j
      ),
    })),
  addJob: (job) =>
    set((state) => ({ activeJobs: [job, ...state.activeJobs] })),

  // Videos
  videos: [],
  setVideos: (videos) => set({ videos }),
  addVideo: (video) =>
    set((state) => ({ videos: [video, ...state.videos] })),
  removeVideo: (videoId) =>
    set((state) => ({
      videos: state.videos.filter((v) => v.id !== videoId),
    })),

  // UI
  sidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
