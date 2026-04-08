/**
 * Dev Content Queue API
 *
 * GET   /api/dev/content-queue — List queue items (filterable by status, page_id)
 * POST  /api/dev/content-queue — Add item to queue
 * PATCH /api/dev/content-queue — Update item status
 *
 * Auth: CRON_SECRET header or development environment required.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { selectEngine, createCostEntry } from "@/lib/dev-engine-router";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");
  if (secret && secret === process.env.CRON_SECRET) return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

// ---------------------------------------------------------------------------
// GET — List queue items
// Query params: ?status=pending&page_id=xxx&limit=20
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { searchParams } = req.nextUrl;

    const status = searchParams.get("status");
    const pageId = searchParams.get("page_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    let query = supabase
      .from("dev_content_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }
    if (pageId) {
      query = query.eq("page_id", pageId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[DEV] Content queue GET error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[DEV] Content queue GET — returned ${data?.length ?? 0} items`);
    return NextResponse.json({ items: data, count: data?.length ?? 0 });
  } catch (err) {
    console.error("[DEV] Content queue GET unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Add item to queue
// Body: { page_id, pillar, caption, hashtags, input_data, scheduled_time?,
//         viral_score?, news_topic_id? }
// ---------------------------------------------------------------------------

interface QueueInsertBody {
  page_id: string;
  pillar: string;
  caption: string;
  hashtags?: string[];
  input_data?: Record<string, unknown>;
  scheduled_time?: string;
  viral_score?: number;
  news_topic_id?: string;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as QueueInsertBody;

    // Validate required fields
    if (!body.page_id || !body.pillar) {
      return NextResponse.json(
        { error: "Missing required fields: page_id, pillar" },
        { status: 400 }
      );
    }
    if (!body.caption) {
      return NextResponse.json(
        { error: "Missing required field: caption" },
        { status: 400 }
      );
    }

    // Use smart engine router to pick the best model
    const engineSelection = selectEngine(body.pillar);
    console.log(
      `[DEV] Engine selected: ${engineSelection.modelId} — ${engineSelection.reason}`
    );

    // Build cost tracking entry
    const costEntry = createCostEntry(engineSelection, body.pillar, body.page_id);

    const supabase = createSupabaseAdmin();

    // Insert into content queue
    const { data, error } = await supabase
      .from("dev_content_queue")
      .insert({
        page_id: body.page_id,
        pillar: body.pillar,
        status: "pending",
        engine: engineSelection.modelId,
        input_data: body.input_data ?? {},
        caption: body.caption,
        hashtags: body.hashtags ?? [],
        scheduled_time: body.scheduled_time ?? null,
        viral_score: body.viral_score ?? 0,
        news_topic_id: body.news_topic_id ?? null,
        cost_usd: engineSelection.estimatedCostUsd,
      })
      .select()
      .single();

    if (error) {
      console.error("[DEV] Content queue POST insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also log cost estimate
    const { error: costError } = await supabase
      .from("dev_generation_costs")
      .insert({
        engine: costEntry.engine,
        pillar: costEntry.pillar,
        page_id: costEntry.page_id,
        estimated_cost_usd: costEntry.estimated_cost_usd,
      });

    if (costError) {
      console.warn("[DEV] Cost tracking insert failed (non-fatal):", costError.message);
    }

    console.log(`[DEV] Content queue POST — queued item ${data.id} for ${body.page_id}`);
    return NextResponse.json({ item: data, engine: engineSelection }, { status: 201 });
  } catch (err) {
    console.error("[DEV] Content queue POST unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — Update item status
// Body: { id, status?, video_url?, error_message?, posted_at?, cost_usd? }
// ---------------------------------------------------------------------------

interface QueueUpdateBody {
  id: string;
  status?: string;
  video_url?: string;
  error_message?: string;
  posted_at?: string;
  cost_usd?: number;
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as QueueUpdateBody;

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["pending", "generating", "ready", "posted", "failed"];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Build the update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.video_url) updateData.video_url = body.video_url;
    if (body.error_message !== undefined) updateData.error_message = body.error_message;
    if (body.posted_at) updateData.posted_at = body.posted_at;
    if (body.cost_usd !== undefined) updateData.cost_usd = body.cost_usd;

    // Set generated_at timestamp when status transitions to ready
    if (body.status === "ready") {
      updateData.generated_at = new Date().toISOString();
    }
    // Set posted_at timestamp when status transitions to posted (if not provided)
    if (body.status === "posted" && !body.posted_at) {
      updateData.posted_at = new Date().toISOString();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No update fields provided" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("dev_content_queue")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("[DEV] Content queue PATCH error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Queue item not found" },
        { status: 404 }
      );
    }

    // Update actual cost in cost tracker if cost_usd provided
    if (body.cost_usd !== undefined) {
      const { error: costError } = await supabase
        .from("dev_generation_costs")
        .update({ actual_cost_usd: body.cost_usd })
        .eq("page_id", data.page_id)
        .eq("engine", data.engine)
        .is("actual_cost_usd", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (costError) {
        console.warn("[DEV] Cost tracking update failed (non-fatal):", costError.message);
      }
    }

    console.log(
      `[DEV] Content queue PATCH — updated item ${body.id} → ${body.status ?? "fields updated"}`
    );
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("[DEV] Content queue PATCH unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
