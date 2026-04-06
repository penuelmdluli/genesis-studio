import { NextResponse } from "next/server";
import { getLoadSheddingStatus } from "@/lib/loadshedding";

export async function GET() {
  try {
    const status = await getLoadSheddingStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { stage: 0, stageName: "Unknown", note: "Failed to fetch" },
      { status: 500 }
    );
  }
}
