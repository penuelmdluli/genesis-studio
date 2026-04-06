/**
 * Genesis Studio — Scaling Thresholds & Cost Tracking
 * Know exactly when you need to upgrade each service.
 */

export interface ServiceTier {
  service: string;
  currentTier: string;
  monthlyLimit: string;
  monthlyCost: number;
  upgradeAt: string; // When to upgrade
  upgradeTier: string;
  upgradeCost: number;
  notes: string;
}

/**
 * Current service tier map with upgrade thresholds.
 * Update these as you scale.
 */
export const SERVICE_TIERS: ServiceTier[] = [
  {
    service: "Supabase",
    currentTier: "Free",
    monthlyLimit: "500MB DB, 50K auth, 2GB bandwidth",
    monthlyCost: 0,
    upgradeAt: "500+ users or 500MB DB",
    upgradeTier: "Pro",
    upgradeCost: 25,
    notes: "Enable PITR (Point-in-Time Recovery) on Pro",
  },
  {
    service: "Clerk",
    currentTier: "Free",
    monthlyLimit: "10,000 MAUs",
    monthlyCost: 0,
    upgradeAt: "10,000 users",
    upgradeTier: "Pro",
    upgradeCost: 25,
    notes: "$0.02/MAU after 10K",
  },
  {
    service: "Vercel",
    currentTier: "Pro",
    monthlyLimit: "1TB bandwidth, 100GB-hours serverless",
    monthlyCost: 20,
    upgradeAt: "100GB-hours or 1TB bandwidth",
    upgradeTier: "Enterprise",
    upgradeCost: 150,
    notes: "Functions timeout: 60s Pro, 900s Enterprise",
  },
  {
    service: "FAL.AI",
    currentTier: "Pay-as-you-go",
    monthlyLimit: "No limit (per-second billing)",
    monthlyCost: 0,
    upgradeAt: "At $5K/mo, negotiate volume discount",
    upgradeTier: "Enterprise",
    upgradeCost: 0,
    notes: "Kling: $0.035/s, Veo: $0.10/s, Seedance: $0.035/s",
  },
  {
    service: "RunPod",
    currentTier: "Serverless",
    monthlyLimit: "No hard limit",
    monthlyCost: 0,
    upgradeAt: "At $2K/mo, consider reserved GPUs",
    upgradeTier: "Reserved GPU",
    upgradeCost: 800,
    notes: "Reserved A6000: ~$0.79/hr vs $1.15/hr spot",
  },
  {
    service: "Cloudflare R2",
    currentTier: "Free",
    monthlyLimit: "10GB storage, 10M reads, 1M writes",
    monthlyCost: 0,
    upgradeAt: "10GB storage or 10M reads",
    upgradeTier: "Pay-as-you-go",
    upgradeCost: 5,
    notes: "$0.015/GB/month, no egress fees",
  },
  {
    service: "Resend",
    currentTier: "Free",
    monthlyLimit: "3,000 emails/month, 100/day",
    monthlyCost: 0,
    upgradeAt: "100 emails/day or custom domain needed",
    upgradeTier: "Pro",
    upgradeCost: 20,
    notes: "Pro: 50K emails/month, custom domain, analytics",
  },
  {
    service: "Anthropic (Claude)",
    currentTier: "Pay-as-you-go",
    monthlyLimit: "Rate limits apply",
    monthlyCost: 5,
    upgradeAt: "Budget tracking — monitor monthly spend",
    upgradeTier: "Same tier",
    upgradeCost: 0,
    notes: "Haiku: $0.25/MTok in, $1.25/MTok out. Used for enhance/moderate/quality",
  },
];

/**
 * Calculate estimated monthly costs at a given user count.
 */
export function estimateMonthlyCosts(activeUsers: number, videosPerDay: number): {
  services: { service: string; cost: number }[];
  total: number;
  perUser: number;
} {
  const avgVideoDurationS = 6;
  const avgGpuCostPerVideo = 0.08; // weighted average across models
  const gpuCost = videosPerDay * 30 * avgGpuCostPerVideo;

  const services = [
    { service: "Supabase", cost: activeUsers > 500 ? 25 : 0 },
    { service: "Clerk", cost: activeUsers > 10000 ? 25 + (activeUsers - 10000) * 0.02 : 0 },
    { service: "Vercel", cost: 20 },
    { service: "GPU (FAL+RunPod)", cost: gpuCost },
    { service: "R2 Storage", cost: Math.max(0, (activeUsers * 0.5 - 10) * 0.015) }, // ~0.5GB per user
    { service: "Resend", cost: activeUsers > 1000 ? 20 : 0 },
    { service: "Claude API", cost: Math.ceil(videosPerDay * 30 * 0.001) }, // ~$0.001 per moderation+enhance
    { service: "Domain + Misc", cost: 5 },
  ];

  const total = services.reduce((s, svc) => s + svc.cost, 0);

  return {
    services,
    total: Math.round(total * 100) / 100,
    perUser: activeUsers > 0 ? Math.round((total / activeUsers) * 100) / 100 : 0,
  };
}

/**
 * User count thresholds where action is needed.
 */
export const SCALING_MILESTONES = [
  { users: 100, action: "Enable Supabase PITR backups" },
  { users: 500, action: "Upgrade Supabase to Pro ($25/mo)" },
  { users: 1000, action: "Upgrade Resend to Pro ($20/mo). Enable weekly digests." },
  { users: 2500, action: "Set up Sentry error monitoring ($29/mo)" },
  { users: 5000, action: "Negotiate FAL.AI volume pricing. Consider RunPod reserved GPUs." },
  { users: 10000, action: "Clerk starts charging ($0.02/MAU). Review all costs." },
  { users: 25000, action: "Consider Vercel Enterprise. Hire DevOps." },
  { users: 50000, action: "Multi-region deployment. CDN for video delivery." },
];
