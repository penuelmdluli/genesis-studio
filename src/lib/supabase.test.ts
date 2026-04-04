import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  })),
}));

import { createSupabaseClient, createSupabaseAdmin } from "./supabase";
import { createClient } from "@supabase/supabase-js";

describe("createSupabaseClient", () => {
  it("creates a client with anon key", () => {
    createSupabaseClient();
    expect(createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
  });
});

describe("createSupabaseAdmin", () => {
  it("creates a client with service role key", () => {
    createSupabaseAdmin();
    expect(createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-service-role-key"
    );
  });
});
