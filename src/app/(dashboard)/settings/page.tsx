"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { User, CreditCard, Bell, Shield, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useStore();

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/user/billing-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Billing portal error:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
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
            <User className="w-4 h-4 text-violet-400" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Name</label>
              <Input value={user?.name || ""} readOnly className="bg-zinc-900" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Email</label>
              <Input value={user?.email || ""} readOnly className="bg-zinc-900" />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Profile is managed through Clerk. Click your avatar to update.
          </p>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/30 border border-zinc-800">
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

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-amber-400" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Generation complete", desc: "Get notified when your video is ready" },
            { label: "Low credits", desc: "Alert when credits drop below 10" },
            { label: "Product updates", desc: "New features and model releases" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-zinc-200">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
              <button className="w-9 h-5 rounded-full bg-violet-500 relative">
                <div
                  className="w-4 h-4 rounded-full bg-white shadow absolute top-0.5"
                  style={{ right: "2px" }}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-400">
            <Shield className="w-4 h-4" />
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
            <Button variant="danger" size="sm">
              <Trash2 className="w-3 h-3" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
