import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { NextResponse } from "next/server";

export async function requireStudioOwner(): Promise<
  { clerkId: string } | NextResponse
> {
  const clerkId = await getAuthUserId();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { clerkId };
}
