// GET /api/spotlight — this week's Feature of the Week for the signed-in user.
// Guests get the general pick so the popup can still sell the studio.

import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { pickSpotlight, spotlightUrl, spotlightWeek } from "@/lib/feature-spotlight";
import { spotlightForUser } from "@/lib/spotlight-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  const clerkId = await getAuthUserId();
  const user = clerkId ? await getUserByClerkId(clerkId) : null;

  const { week, spotlight } = user
    ? await spotlightForUser(user.id)
    : { week: spotlightWeek().key, spotlight: pickSpotlight() };

  // Only what the popup shows; subject lines and targeting stay server-side.
  const { id, emoji, title, hook, benefits, idea, cta, cost, poster, video } = spotlight;
  return NextResponse.json({
    week,
    signedIn: !!user,
    spotlight: {
      id, emoji, title, hook, benefits, idea, cta, cost, poster, video,
      href: spotlightUrl(appUrl, spotlight, "popup", week).replace(appUrl, ""),
    },
  });
}
