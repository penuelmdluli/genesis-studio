import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, createApiKey, getUserApiKeys } from "@/lib/db";
import { generateApiKey } from "@/lib/utils";
import { createHash } from "crypto";

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

    const keys = await getUserApiKeys(user.id);

    return NextResponse.json({
      keys: keys.map((k: Record<string, unknown>) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.key_prefix,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        isActive: k.is_active,
      })),
    });
  } catch (error) {
    console.error("Get API keys error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Key name is required" },
        { status: 400 }
      );
    }

    // Generate a new API key
    const rawKey = generateApiKey();
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 11); // "gs_" + 8 chars

    const apiKey = await createApiKey({
      userId: user.id,
      name: name.trim(),
      keyPrefix,
      keyHash,
    });

    return NextResponse.json({
      id: apiKey.id,
      key: rawKey, // Only shown once
      name: apiKey.name,
      keyPrefix,
    });
  } catch (error) {
    console.error("Create API key error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
