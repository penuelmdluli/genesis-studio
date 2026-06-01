import { NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";

export async function GET() {
  try {
    const db = getDb();

    const [videos, explore, users, today] = await Promise.all([
      db.from("generation_jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
      db.from("explore_videos").select("id", { count: "exact", head: true }),
      db.from("users").select("id", { count: "exact", head: true }),
      db.from("generation_jobs").select("id", { count: "exact", head: true }).eq("status", "completed").gt("created_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]) as { count?: number }[];

    return NextResponse.json(
      {
        totalVideos: videos.count ?? 0,
        totalExplore: explore.count ?? 0,
        totalUsers: users.count ?? 0,
        videosToday: today.count ?? 0,
        modelsAvailable: 12,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
