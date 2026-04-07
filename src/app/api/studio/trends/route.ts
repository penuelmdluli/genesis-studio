import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { getStudioTrends } from "@/lib/studio/db";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = request.nextUrl;
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];
    const niche = searchParams.get("niche") || undefined;

    const trends = await getStudioTrends(date, niche);

    return NextResponse.json({ date, trends });
  } catch (error) {
    console.error("[Studio] Get trends error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
