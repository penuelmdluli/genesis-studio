"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Rocket, ArrowLeft } from "lucide-react";
import { Button } from "./button";

interface ComingSoonGateProps {
  featureId: string;
  featureName: string;
  children: React.ReactNode;
}

/**
 * Wraps a feature page. If the feature's RunPod endpoint is not configured,
 * shows a "Coming Soon" overlay instead of the actual page content.
 */
export function ComingSoonGate({ featureId, featureName, children }: ComingSoonGateProps) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/features/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.features) {
          setAvailable(data.features[featureId] ?? false);
        } else {
          setAvailable(true); // fail open — show the page if API fails
        }
      })
      .catch(() => setAvailable(true));
  }, [featureId]);

  // Loading state — don't flash either view
  if (available === null) return null;

  // Feature is available — render the actual page
  if (available) return <>{children}</>;

  // Feature not available — show Coming Soon
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-violet-500/15 flex items-center justify-center mb-6">
        <Rocket className="w-8 h-8 text-violet-400" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">
        {featureName} — Coming Soon
      </h1>
      <p className="text-sm text-zinc-500 max-w-md mb-8">
        We&apos;re putting the finishing touches on {featureName}.
        This feature will be available shortly. Stay tuned!
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
        </Link>
        <Link href="/generate">
          <Button size="sm">
            Generate a Video
          </Button>
        </Link>
      </div>
    </div>
  );
}
