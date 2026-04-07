"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition, MotionSection } from "@/components/ui/motion";
import {
  Globe,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
  Link2,
  Settings,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectedPage {
  id: string;
  page_id: string;
  page_name: string;
  niche: string | null;
  is_active: boolean;
  follower_count: number;
}

const NICHE_OPTIONS = [
  { value: "", label: "Select a niche..." },
  { value: "news", label: "News" },
  { value: "finance", label: "Finance" },
  { value: "motivation", label: "Motivation" },
  { value: "entertainment", label: "Entertainment" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudioSetupPage() {
  const [pages, setPages] = useState<ConnectedPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [nicheSelections, setNicheSelections] = useState<
    Record<string, string>
  >({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = pages.length > 0;
  const allNichesAssigned =
    isConnected &&
    pages.every(
      (p) =>
        nicheSelections[p.id] ||
        p.niche
    );

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/facebook/pages");
      if (res.ok) {
        const data = await res.json();
        const fetchedPages: ConnectedPage[] = data.pages || [];
        setPages(fetchedPages);

        // Pre-fill niche selections from existing data
        const selections: Record<string, string> = {};
        for (const page of fetchedPages) {
          if (page.niche) {
            selections[page.id] = page.niche;
          }
        }
        setNicheSelections(selections);
      }
    } catch (err) {
      console.error("[Studio Setup] Failed to fetch pages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleNicheChange = (pageId: string, niche: string) => {
    setNicheSelections((prev) => ({ ...prev, [pageId]: niche }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updates = Object.entries(nicheSelections).map(
        ([pageId, niche]) => ({
          pageId,
          niche,
        })
      );

      const results = await Promise.allSettled(
        updates.map(({ pageId, niche }) =>
          fetch("/api/studio/facebook/pages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId, niche, is_active: true }),
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        setError(`Failed to update ${failed.length} page(s). Please retry.`);
      } else {
        setSaveSuccess(true);
        await fetchPages();
      }
    } catch (err) {
      console.error("[Studio Setup] Save error:", err);
      setError("Failed to save niche assignments. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Determine current step
  const currentStep = !isConnected ? 1 : !allNichesAssigned ? 2 : 3;

  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            <p className="text-zinc-400 text-sm">Loading setup...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <MotionSection>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
              <Settings className="w-8 h-8 text-violet-500" />
              Content Engine Setup
            </h1>
            <p className="text-zinc-400 mt-2">
              Connect your Facebook pages and assign niches to get started
            </p>
          </div>
        </MotionSection>

        {/* Progress Steps */}
        <MotionSection delay={0.05}>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step < currentStep
                      ? "bg-emerald-500 text-white"
                      : step === currentStep
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                  }`}
                >
                  {step < currentStep ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    step
                  )}
                </div>
                {step < 3 && (
                  <div
                    className={`w-16 h-0.5 ${
                      step < currentStep ? "bg-emerald-500" : "bg-zinc-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-2 px-2">
            <span>Connect</span>
            <span>Assign Niches</span>
            <span>Ready</span>
          </div>
        </MotionSection>

        {/* Step 1: Connect Facebook */}
        <MotionSection delay={0.1}>
          <Card
            className={`border transition-colors ${
              currentStep === 1
                ? "bg-zinc-900/90 border-violet-500/30"
                : "bg-zinc-900/50 border-zinc-800"
            }`}
          >
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-violet-400" />
                Step 1: Connect Facebook Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isConnected ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Connected ({pages.length} page
                    {pages.length !== 1 ? "s" : ""} found)
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400">
                    Connect your Facebook account to allow the Content Engine to
                    publish videos to your pages automatically.
                  </p>
                  <Link href="/api/studio/facebook/auth">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0">
                      <Globe className="w-4 h-4 mr-2" />
                      Connect Facebook
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </MotionSection>

        {/* Step 2: Assign Niches */}
        <MotionSection delay={0.15}>
          <Card
            className={`border transition-colors ${
              currentStep === 2
                ? "bg-zinc-900/90 border-violet-500/30"
                : "bg-zinc-900/50 border-zinc-800"
            }`}
          >
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-violet-400" />
                Step 2: Assign Niches to Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isConnected ? (
                <p className="text-sm text-zinc-500">
                  Connect your Facebook account first to see your pages.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400">
                    Choose a content niche for each page. The engine will
                    generate and post niche-specific content to the matching
                    page.
                  </p>

                  <div className="space-y-3">
                    {pages.map((page) => (
                      <div
                        key={page.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {page.page_name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {page.follower_count.toLocaleString()} followers
                          </p>
                        </div>
                        <select
                          value={nicheSelections[page.id] || ""}
                          onChange={(e) =>
                            handleNicheChange(page.id, e.target.value)
                          }
                          className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                          {NICHE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}

                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !allNichesAssigned}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Save Niche Assignments
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </MotionSection>

        {/* Step 3: Success */}
        <MotionSection delay={0.2}>
          <Card
            className={`border transition-colors ${
              saveSuccess || currentStep === 3
                ? "bg-zinc-900/90 border-emerald-500/30"
                : "bg-zinc-900/50 border-zinc-800"
            }`}
          >
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Step 3: Engine Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {saveSuccess || currentStep === 3 ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Engine is ready!
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Your content pipeline is configured. Trends will be
                      fetched, scripts generated, and videos posted
                      automatically.
                    </p>
                  </div>
                  <Link href="/studio">
                    <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0">
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Complete the steps above to activate the Content Engine.
                </p>
              )}
            </CardContent>
          </Card>
        </MotionSection>
      </div>
    </PageTransition>
  );
}
