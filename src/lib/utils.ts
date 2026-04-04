import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCredits(credits: number): string {
  if (credits < 0) return "Unlimited";
  return credits.toLocaleString();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

export function generateApiKey(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "gs_";
  let key = prefix;
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export function truncatePrompt(prompt: string, maxLen = 80): string {
  if (prompt.length <= maxLen) return prompt;
  return prompt.slice(0, maxLen) + "...";
}

export function estimateCreditCost(
  modelId: string,
  resolution: string,
  duration: number,
  isDraft: boolean
): number {
  // Base costs from model config, adjusted by duration and draft mode
  const baseCosts: Record<string, Record<string, number>> = {
    "wan-2.2": { "480p": 20, "720p": 40, "1080p": 80 },
    "hunyuan-video": { "480p": 12, "720p": 25 },
    "ltx-video": { "480p": 5, "720p": 8 },
    "wan-2.1-turbo": { "480p": 10, "720p": 20 },
    "mochi-1": { "480p": 20, "720p": 35, "1080p": 70 },
    "cogvideo-x": { "480p": 3 },
  };

  const modelCosts = baseCosts[modelId];
  if (!modelCosts) return 10;

  const baseCost = modelCosts[resolution] || modelCosts["480p"] || 10;
  const durationMultiplier = duration / 5; // normalized to 5s base
  const draftDiscount = isDraft ? 0.3 : 1;

  return Math.ceil(baseCost * durationMultiplier * draftDiscount);
}
