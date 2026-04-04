import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockOrder = vi.fn().mockReturnThis();
const mockRange = vi.fn();

vi.mock("./supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));

mockFrom.mockReturnValue({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  single: mockSingle,
  order: mockOrder,
  range: mockRange,
});

// Chain methods need to return the query builder
mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
mockEq.mockReturnValue({ single: mockSingle, eq: mockEq, order: mockOrder });
mockOrder.mockReturnValue({ range: mockRange });

import {
  getCreditBalance,
  deductCredits,
  refundCredits,
  grantSubscriptionCredits,
  addCreditPackCredits,
  getTransactionHistory,
} from "./credits";

describe("getCreditBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { credit_balance: 500 },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it("returns the credit balance", async () => {
    const balance = await getCreditBalance("user-123");
    expect(balance).toBe(500);
  });
});

describe("deductCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success=false when balance is insufficient", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { credit_balance: 5 },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const result = await deductCredits("user-123", 100, "job-1", "Test deduction");
    expect(result.success).toBe(false);
    expect(result.newBalance).toBe(5);
  });

  it("deducts credits and returns new balance on success", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { credit_balance: 500 },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const result = await deductCredits("user-123", 100, "job-1", "Test deduction");
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(400);
  });
});

describe("refundCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { credit_balance: 400 },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it("adds credits back and returns new balance", async () => {
    const newBalance = await refundCredits("user-123", 100, "job-1", "Refund");
    expect(newBalance).toBe(500);
  });
});

describe("grantSubscriptionCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { credit_balance: 100 },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it("grants subscription credits", async () => {
    const newBalance = await grantSubscriptionCredits("user-123", 500);
    expect(newBalance).toBe(600);
  });
});

describe("addCreditPackCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { credit_balance: 200 },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it("adds credit pack credits", async () => {
    const newBalance = await addCreditPackCredits("user-123", 2000, "pack-2000");
    expect(newBalance).toBe(2200);
  });
});
