import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/support — list all support tickets (escalated chats)
 * POST /api/admin/support — reply to a ticket (sends email to user)
 * Owner only.
 */

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ tickets: tickets || [] });
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const { ticketId, reply } = await req.json();
  if (!ticketId || !reply) {
    return NextResponse.json({ error: "ticketId and reply required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Get the ticket
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Send email reply to user
  if (ticket.user_email) {
    try {
      const { sendSupportReply } = await import("@/lib/email");
      await sendSupportReply(ticket.user_email, ticket.user_name || "Creator", reply, ticket.message);
    } catch (err) {
      console.error("[SUPPORT] Email send failed:", err);
      // Continue — still update the ticket
    }
  }

  // Update ticket with reply
  await supabase
    .from("support_tickets")
    .update({
      status: "replied",
      admin_reply: reply,
      replied_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  return NextResponse.json({ success: true });
}
