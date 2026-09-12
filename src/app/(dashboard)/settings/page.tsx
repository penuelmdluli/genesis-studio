"use client";

import { useState, useEffect } from "react";
import { uploadFile } from "@/lib/upload-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PageTransition, MotionSection } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { STORAGE_LIMITS } from "@/lib/profitability";
import { Switch } from "@/components/ui/switch";
import { GenesisButtonLoader } from "@/components/ui/genesis-loader";
import { User, CreditCard, Bell, Shield, Trash2, ExternalLink, HardDrive, ArrowUpRight, Download, History, Sparkles, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { user, isInitialized } = useStore();
  const { toast } = useToast();
  const { signOut } = useAuth();

  // Brand Kit — a paid creator's own logo, loaded on mount so the card can
  // show the upsell or the real thing rather than guessing from plan alone.
  const [brandLoading, setBrandLoading] = useState(true);
  const [brandAllowed, setBrandAllowed] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [brandPosition, setBrandPosition] = useState("bottom-right");
  const [brandEnabled, setBrandEnabled] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/brand-kit")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setBrandAllowed(!!d.allowed);
        setBrandLogo(d.brand?.logoUrl || null);
        setBrandName(d.brand?.name || "");
        setBrandPosition(d.brand?.position || "bottom-right");
        setBrandEnabled(!!d.brand?.enabled);
      })
      .catch(() => {})
      .finally(() => setBrandLoading(false));
  }, []);

  const handleBrandLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("That logo is over 2 MB — try a smaller PNG.", "error");
      return;
    }
    setBrandSaving(true);
    try {
      const url = await uploadFile(file, "image");
      setBrandLogo(url);
      toast("Logo uploaded — remember to save.", "success");
    } catch {
      toast("Could not upload that logo. Please try again.", "error");
    } finally {
      setBrandSaving(false);
    }
  };

  const saveBrandKit = async () => {
    setBrandSaving(true);
    try {
      const res = await fetch("/api/user/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: brandLogo, name: brandName, position: brandPosition, enabled: brandEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not save your branding.", "error");
        return;
      }
      setBrandEnabled(!!data.brand?.enabled);
      toast(data.note || "Branding saved.", data.note ? "info" : "success");
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setBrandSaving(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [videoCount, setVideoCount] = useState(0);
  const [creditHistory, setCreditHistory] = useState<{ id: string; type: string; amount: number; description: string; created_at: string }[]>([]);
  const [creditHistoryLoading, setCreditHistoryLoading] = useState(false);
  const [creditHistoryLoaded, setCreditHistoryLoaded] = useState(false);
  const [notifications, setNotifications] = useState({
    generationComplete: true,
    lowCredits: true,
    productUpdates: true,
  });

  // Fetch video count for storage display
  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.ok ? r.json() : { videos: [] })
      .then((data) => setVideoCount(data.videos?.length || 0))
      .catch(() => {});
  }, []);

  const loadCreditHistory = async () => {
    if (creditHistoryLoaded) return;
    setCreditHistoryLoading(true);
    try {
      const res = await fetch("/api/user/credit-history?limit=20");
      if (res.ok) {
        const data = await res.json();
        setCreditHistory(data.transactions || []);
        setCreditHistoryLoaded(true);
      }
    } catch {
      toast("Failed to load credit history", "error");
    } finally {
      setCreditHistoryLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/user/billing-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Billing portal error:", err);
      toast("Failed to open billing portal", "error");
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/user/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `genesis-studio-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("Data exported successfully", "success");
    } catch {
      toast("Failed to export data", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/user/delete-account", { method: "POST" });
      if (!res.ok) throw new Error("Deletion failed");
      toast("Account deleted. Signing out...", "success");
      setShowDeleteModal(false);
      // Redirect to home after short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch {
      toast("Failed to delete account. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    toast("Notification preference updated", "success");
  };

  return (
    <PageTransition className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your account and preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-violet-400" />
            </div>
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5 font-medium">Name</label>
              <Input value={user?.name || ""} readOnly className="bg-white/[0.04] cursor-default" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5 font-medium">Email</label>
              <Input value={user?.email || ""} readOnly className="bg-white/[0.04] cursor-default truncate" />
            </div>
          </div>
          <p className="text-xs text-zinc-400 flex items-center gap-1">
            Profile is managed through Clerk. Click your avatar to update.
            <ExternalLink className="w-3 h-3" />
          </p>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card glow>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.10]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  Current Plan
                </span>
                <Badge variant="violet" className="capitalize">
                  {user?.plan || "free"}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {user?.monthlyCreditsLimit?.toLocaleString() || 50} credits/month
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleManageBilling} className="w-full sm:w-auto">
              Manage Billing
            </Button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Credit Balance</span>
            <span className="font-bold text-violet-300">
              {user?.creditBalance?.toLocaleString() || 50} credits
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Credit History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <History className="w-3.5 h-3.5 text-violet-400" />
            </div>
            Credit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!creditHistoryLoaded ? (
            <Button variant="secondary" size="sm" onClick={loadCreditHistory} disabled={creditHistoryLoading} className="w-full">
              {creditHistoryLoading ? <GenesisButtonLoader /> : <History className="w-3 h-3 mr-1.5" />}
              {creditHistoryLoading ? "Loading..." : "View Credit History"}
            </Button>
          ) : creditHistory.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">No credit transactions yet.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {creditHistory.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{tx.description || tx.type}</p>
                    <p className="text-xs text-zinc-400">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ml-3 ${
                    tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const plan = (user?.plan || "free") as keyof typeof STORAGE_LIMITS;
            const limits = STORAGE_LIMITS[plan] || STORAGE_LIMITS.free;
            const isUnlimited = limits.maxVideos === -1;
            const pct = isUnlimited ? 0 : Math.min(100, Math.round((videoCount / limits.maxVideos) * 100));
            const isNearLimit = !isUnlimited && pct >= 80;

            return (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Videos stored</span>
                  <span className={`font-bold ${isNearLimit ? "text-amber-400" : "text-cyan-300"}`}>
                    {videoCount} {isUnlimited ? "videos" : `/ ${limits.maxVideos}`}
                  </span>
                </div>

                {!isUnlimited && (
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isNearLimit ? "bg-amber-500" : "bg-cyan-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    {isUnlimited
                      ? "Unlimited storage on Studio plan"
                      : `${limits.retentionDays} day retention on ${plan} plan`}
                  </span>
                  {!isUnlimited && plan !== "studio" && (
                    <a
                      href="/pricing"
                      className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Upgrade for more <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Brand Kit — your logo on your videos (paid plans) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            Your branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {brandLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : !brandAllowed ? (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
              <p className="text-sm text-zinc-200 font-medium">Put your own logo on your videos</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                On the Creator plan and up you can stamp your own logo and handle onto everything you
                make here — your brand on your work, not ours.
              </p>
              <a
                href="/pricing"
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
              >
                See plans <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-white/[0.12] bg-white/[0.04] flex items-center justify-center overflow-hidden shrink-0">
                  {brandLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brandLogo} alt="Your logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-zinc-500 text-center px-2">No logo yet</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleBrandLogo}
                      disabled={brandSaving}
                    />
                    {brandSaving ? "Uploading…" : brandLogo ? "Replace logo" : "Upload logo"}
                  </label>
                  <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                    PNG with a transparent background works best. Keep it under 2&nbsp;MB.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Brand name or handle</label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="@yourhandle"
                  maxLength={60}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Where it sits</label>
                <select
                  value={brandPosition}
                  onChange={(e) => setBrandPosition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.12] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                >
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="top-right">Top right</option>
                  <option value="top-left">Top left</option>
                </select>
              </div>

              <div className="py-1">
                <Switch
                  checked={brandEnabled}
                  onCheckedChange={() => setBrandEnabled(!brandEnabled)}
                  label="Use my branding"
                  description="Apply it when you add your logo to a video"
                />
              </div>

              <button
                onClick={saveBrandKit}
                disabled={brandSaving}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {brandSaving ? "Saving…" : "Save branding"}
              </button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
            </div>
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {([
            { key: "generationComplete" as const, label: "Generation complete", desc: "Get notified when your video is ready" },
            { key: "lowCredits" as const, label: "Low credits", desc: "Alert when credits drop below 10" },
            { key: "productUpdates" as const, label: "Product updates", desc: "New features and model releases" },
          ]).map((item) => (
            <div key={item.key} className="py-3 px-1">
              <Switch
                checked={notifications[item.key]}
                onCheckedChange={() => toggleNotification(item.key)}
                label={item.label}
                description={item.desc}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Download className="w-3.5 h-3.5 text-blue-400" />
            </div>
            Data &amp; Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-200">Export Your Data</p>
              <p className="text-xs text-zinc-400">
                Download all your data as a JSON file (POPIA/GDPR).
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportData} disabled={isExporting} className="w-full sm:w-auto">
              {isExporting ? <GenesisButtonLoader /> : <Download className="w-3 h-3" />}
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Signing out is the thing people look for every day. It was hidden
          behind an unlabelled avatar while "Delete Account" got its own red
          section — the reversible action should be easier to find than the
          irreversible one. */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">Sign out</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              End this session on this device. Your videos and credits stay exactly as they are.
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="shrink-0 px-4 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-sm font-medium text-zinc-100 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-400">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-red-400" />
            </div>
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-200">Delete Account</p>
              <p className="text-xs text-zinc-400">
                Permanently delete your account and all data. This cannot be undone.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)} className="w-full sm:w-auto">
              <Trash2 className="w-3 h-3" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
        description="This action is permanent and cannot be undone."
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-red-500/[0.06] border border-red-500/15">
            <p className="text-sm text-zinc-300">
              All your data, including videos, API keys, and credit balance, will be permanently deleted.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteAccount} disabled={isDeleting}>
              {isDeleting ? <GenesisButtonLoader /> : <Trash2 className="w-3 h-3" />}
              {isDeleting ? "Deleting..." : "Delete My Account"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
