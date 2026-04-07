import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import {
  getStudioPages,
  createStudioPage,
  updateStudioPage,
  deleteStudioPage,
} from "@/lib/studio/db";

export async function GET() {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const pages = await getStudioPages(authResult.clerkId);
    return NextResponse.json({ pages });
  } catch (error) {
    console.error("[Studio] Get pages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { pageId, pageName, accessToken, niche } = body;

    if (!pageId || !pageName || !accessToken || !niche) {
      return NextResponse.json(
        { error: "Missing required fields: pageId, pageName, accessToken, niche" },
        { status: 400 }
      );
    }

    const validNiches = ["news", "finance", "motivation", "entertainment"];
    if (!validNiches.includes(niche)) {
      return NextResponse.json(
        { error: `Invalid niche. Must be one of: ${validNiches.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if page already exists for this owner
    const existingPages = await getStudioPages(authResult.clerkId);
    const existing = existingPages.find((p) => p.page_id === pageId);

    if (existing) {
      // Update existing page
      const updated = await updateStudioPage(existing.id, {
        page_name: pageName,
        page_access_token: accessToken,
        niche,
      });
      return NextResponse.json({ page: updated, updated: true });
    }

    // Create new page
    const page = await createStudioPage({
      owner_id: authResult.clerkId,
      page_id: pageId,
      page_name: pageName,
      page_access_token: accessToken,
      niche,
    });

    return NextResponse.json({ page, created: true }, { status: 201 });
  } catch (error) {
    console.error("[Studio] Create/update page error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { pageId } = body;

    if (!pageId) {
      return NextResponse.json(
        { error: "Missing required field: pageId" },
        { status: 400 }
      );
    }

    // Find the page by facebook page_id to verify ownership
    const existingPages = await getStudioPages(authResult.clerkId);
    const existing = existingPages.find((p) => p.page_id === pageId);

    if (!existing) {
      return NextResponse.json(
        { error: "Page not found" },
        { status: 404 }
      );
    }

    await deleteStudioPage(existing.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[Studio] Delete page error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
