import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { NextResponse } from "next/server";

export async function requireStudioOwner(): Promise<
  { clerkId: string } | NextResponse
> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { clerkId };
}
