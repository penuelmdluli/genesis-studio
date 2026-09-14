import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { pfEncode, pfSignature } from "./payfast";

describe("PayFast signature", () => {
  it("encodes like PHP urlencode (spaces as +, uppercase hex, !'()* encoded)", () => {
    expect(pfEncode("iVideo Studio Creator Plan")).toBe("iVideo+Studio+Creator+Plan");
    expect(pfEncode("a&b=c/d")).toBe("a%26b%3Dc%2Fd");
    expect(pfEncode("it's (new)!")).toBe("it%27s+%28new%29%21");
  });

  it("signs fields in the given order, skipping blanks, appending passphrase", () => {
    const params = { merchant_id: "10000100", merchant_key: "46f0cd694581a", amount: "100.00", item_name: "Test", name_last: "" };
    const order = ["merchant_id", "merchant_key", "name_last", "amount", "item_name"];
    const expected = crypto
      .createHash("md5")
      .update("merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test&passphrase=jt7NOE43FZPn")
      .digest("hex");
    expect(pfSignature(params, order, "jt7NOE43FZPn")).toBe(expected);
  });

  it("changes when the order changes (so alphabetical would be rejected)", () => {
    const params = { b: "2", a: "1" };
    expect(pfSignature(params, ["a", "b"], "")).not.toBe(pfSignature(params, ["b", "a"], ""));
  });
});
