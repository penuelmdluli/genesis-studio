import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { NextResponse } from "next/server";

/**
 * Returns a 404 response if the caller is not an owner.
 * Returns null + clerkId if they are. Uses 404 (not 403) to avoid
 * revealing the existence of internal routes.
 */
export async function requireOwnerOrNotFound(): Promise<
  { clerkId: string } | NextResponse
> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return { clerkId };
}
