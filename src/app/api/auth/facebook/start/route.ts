// Send a creator to Facebook to grant access to their own Page.
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { authorizeUrl, signState, facebookConfigured } from "@/lib/social/facebook-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!facebookConfigured()) {
    return NextResponse.json(
      { error: "Page posting is not switched on yet. It goes live once Facebook approves the app." },
      { status: 503 }
    );
  }

  return NextResponse.redirect(authorizeUrl(signState(user.id)));
}
