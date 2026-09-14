// ============================================
// GENESIS STUDIO — Brand Kit
// ============================================
// A paying creator's own logo, for their own videos. Paid plans only: this
// is one of the things the plan is for, and a free account that could brand
// its work would have no reason to upgrade.
//
// GET  → the caller's brand kit and whether they are allowed one
// POST → save it ({ logoUrl, name, position, enabled })
//
// The logo is uploaded through /api/upload first, so this only ever stores a
// URL we already host. Anything pointing elsewhere is refused — a logo URL
// is burned into video by a background service, and letting a customer aim
// that at an arbitrary host is a request-forgery hole.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";

export const dynamic = "force-dynamic";

const POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
type Position = (typeof POSITIONS)[number];

function canBrand(plan: string, isOwner: boolean): boolean {
  return isOwner || ["creator", "pro", "studio"].includes(plan);
}

/** Only logos we host. */
function isOwnLogoUrl(url: string): boolean {
  const allowed = [process.env.R2_PUBLIC_URL || "https://cdn.ivideostudio.ai"];
  return allowed.some((base) => url.startsWith(`${base.replace(/\/$/, "")}/`));
}

export async function GET() {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    allowed: canBrand(user.plan, isOwnerClerkId(clerkId)),
    plan: user.plan,
    brand: {
      logoUrl: user.brand_logo_url || null,
      name: user.brand_name || null,
      position: (user.brand_position as Position) || "bottom-right",
      enabled: !!user.brand_enabled,
    },
  });
}

export async function POST(req: NextRequest) {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!canBrand(user.plan, isOwnerClerkId(clerkId))) {
    return NextResponse.json(
      { error: "Your own branding is part of the Creator plan and up.", upgrade: true },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    logoUrl?: string | null;
    name?: string | null;
    position?: string;
    enabled?: boolean;
  };

  if (body.logoUrl && !isOwnLogoUrl(body.logoUrl)) {
    return NextResponse.json({ error: "Upload the logo here rather than linking to it" }, { status: 400 });
  }

  const position = POSITIONS.includes(body.position as Position)
    ? (body.position as Position)
    : "bottom-right";

  // Nothing to stamp means nothing to enable — otherwise "on" would silently
  // do nothing and look like a broken feature.
  const logoUrl = body.logoUrl ?? user.brand_logo_url ?? null;
  const name = (body.name ?? user.brand_name ?? "").toString().slice(0, 60).trim() || null;
  const enabled = !!body.enabled && !!(logoUrl || name);

  const db = getDb();
  const { error } = await db
    .from("users")
    .update({
      brand_logo_url: logoUrl,
      brand_name: name,
      brand_position: position,
      brand_enabled: enabled ? 1 : 0,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[BRAND-KIT] save failed:", error.message);
    return NextResponse.json({ error: "Could not save your brand kit. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    brand: { logoUrl, name, position, enabled },
    note: !enabled && body.enabled ? "Add a logo or a brand name first." : undefined,
  });
}
