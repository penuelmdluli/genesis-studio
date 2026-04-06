import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";
import { generateSchema } from "@/lib/validation";
import { estimateCreditCost } from "@/lib/utils";

/**
 * Schedule videos for later generation.
 * Creates entries in scheduled_generations table.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { scheduledAt, ...generateParams } = body;

    if (!scheduledAt) {
      return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 });
    }

    const scheduleDate = new Date(scheduledAt);
    if (scheduleDate <= new Date()) {
      return NextResponse.json({ error: "scheduledAt must be in the future" }, { status: 400 });
    }

    // Validate the generation params
    const parsed = generateSchema.safeParse(generateParams);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Check they have enough credits for all scheduled + this new one
    const creditCost = estimateCreditCost(
      parsed.data.modelId,
      parsed.data.resolution || "720p",
      parsed.data.duration || 5,
      parsed.data.isDraft || false
    );

    const supabase = createSupabaseAdmin();

    // Get total reserved credits from pending scheduled jobs
    const { data: pendingJobs } = await supabase
      .from("scheduled_generations")
      .select("credits_reserved")
      .eq("user_id", user.id)
      .eq("status", "pending");

    const reservedCredits = (pendingJobs || []).reduce(
      (sum, j) => sum + ((j as Record<string, number>).credits_reserved || 0),
      0
    );

    const availableCredits = (user.credit_balance || 0) - reservedCredits;
    if (availableCredits < creditCost) {
      return NextResponse.json(
        { error: "Not enough credits (including reserved for scheduled jobs)" },
        { status: 402 }
      );
    }

    // Insert scheduled generation
    const { data: scheduled, error: insertError } = await supabase
      .from("scheduled_generations")
      .insert({
        user_id: user.id,
        params: parsed.data,
        credits_reserved: creditCost,
        scheduled_at: scheduleDate.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[SCHEDULE] Insert failed:", insertError);
      return NextResponse.json({ error: "Failed to schedule generation" }, { status: 500 });
    }

    return NextResponse.json({
      id: scheduled.id,
      scheduledAt: scheduleDate.toISOString(),
      creditsReserved: creditCost,
    });
  } catch (error) {
    console.error("Schedule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Get user's scheduled generations.
 */
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
    const { data, error } = await supabase
      .from("scheduled_generations")
      .select("id, params, credits_reserved, scheduled_at, status, created_at")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
    }

    return NextResponse.json({ schedules: data || [] });
  } catch (error) {
    console.error("Schedule fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
