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
  isOwner?: boolean;
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
  enableLiveSound: boolean;
}

export interface AppNotification {
  id: string;
  type: "success" | "error" | "info" | "promo";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
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

  // Notifications
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, "id" | "read" | "createdAt">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  // Data loading
  isInitialized: boolean;
  setInitialized: (val: boolean) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  creditPurchaseOpen: boolean;
  setCreditPurchaseOpen: (open: boolean) => void;
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
  enableLiveSound: false,
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

  // Notifications
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...state.notifications,
      ].slice(0, 50), // Keep max 50
    })),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearNotifications: () => set({ notifications: [] }),

  // Data loading
  isInitialized: false,
  setInitialized: (val) => set({ isInitialized: val }),

  // UI
  sidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  creditPurchaseOpen: false,
  setCreditPurchaseOpen: (open) => set({ creditPurchaseOpen: open }),
}));
