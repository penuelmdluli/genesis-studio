"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PageTransition, MotionSection } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { STORAGE_LIMITS } from "@/lib/profitability";
import { User, CreditCard, Bell, Shield, Trash2, ExternalLink, HardDrive, ArrowUpRight, Download, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useStore();
  const { toast } = useToast();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [videoCount, setVideoCount] = useState(0);
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
        <p className="text-sm text-zinc-500 mt-1">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5 font-medium">Name</label>
              <Input value={user?.name || ""} readOnly className="bg-white/[0.02] cursor-default" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5 font-medium">Email</label>
              <Input value={user?.email || ""} readOnly className="bg-white/[0.02] cursor-default" />
            </div>
          </div>
          <p className="text-xs text-zinc-500 flex items-center gap-1">
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
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  Current Plan
                </span>
                <Badge variant="violet" className="capitalize">
                  {user?.plan || "free"}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {user?.monthlyCreditsLimit?.toLocaleString() || 50} credits/month
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleManageBilling}>
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

                <div className="flex items-center justify-between text-xs text-zinc-500">
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
            <div key={item.key} className="flex items-center justify-between py-3 px-1">
              <div>
                <p className="text-sm text-zinc-200">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
              <button
                onClick={() => toggleNotification(item.key)}
                className={`w-10 h-[22px] rounded-full transition-colors duration-200 relative ${
                  notifications[item.key] ? "bg-violet-500" : "bg-white/[0.1]"
                }`}
                role="switch"
                aria-checked={notifications[item.key]}
                aria-label={item.label}
              >
                <div
                  className="w-[18px] h-[18px] rounded-full bg-white shadow-sm absolute top-[2px] transition-transform duration-200"
                  style={{ transform: notifications[item.key] ? "translateX(20px)" : "translateX(2px)" }}
                />
              </button>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-200">Export Your Data</p>
              <p className="text-xs text-zinc-500">
                Download all your data as a JSON file (POPIA/GDPR).
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportData} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </div>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-200">Delete Account</p>
              <p className="text-xs text-zinc-500">
                Permanently delete your account and all data. This cannot be undone.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
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
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {isDeleting ? "Deleting..." : "Delete My Account"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
