import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPageIntelligenceSummary } from "@/lib/intelligence";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  try {
    const summary = await getPageIntelligenceSummary(pageId);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}
