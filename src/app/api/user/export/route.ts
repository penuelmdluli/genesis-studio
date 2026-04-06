import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    // Gather all user data
    const [jobs, videos, transactions, apiKeys] = await Promise.all([
      supabase
        .from("generation_jobs")
        .select("id, type, model_id, prompt, resolution, duration, status, credits_cost, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("videos")
        .select("id, title, prompt, model_id, resolution, duration, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("credit_transactions")
        .select("type, amount, balance, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("api_keys")
        .select("name, created_at, last_used_at")
        .eq("user_id", user.id),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        creditBalance: user.credit_balance,
        createdAt: user.created_at,
      },
      generationJobs: jobs.data || [],
      videos: videos.data || [],
      creditTransactions: transactions.data || [],
      apiKeys: (apiKeys.data || []).map((k: { name: string; created_at: string; last_used_at: string | null }) => ({
        name: k.name,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="genesis-studio-export-${user.id.slice(0, 8)}.json"`,
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
