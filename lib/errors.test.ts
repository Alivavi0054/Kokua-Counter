import { describe, expect, it } from "vitest";
import { describeError } from "@/lib/errors";

describe("describeError", () => {
  it("describes Error instances, plain objects and unknown values", () => {
    expect(describeError(new Error("Missing X"))).toBe("Error: Missing X");
    expect(describeError({ code: "23505", message: "duplicate", details: "secret-row" })).toBe("23505: duplicate");
    expect(describeError("nope")).toBe("unknown error");
    expect(describeError(null)).toBe("unknown error");
  });

  it("truncates very long messages", () => {
    expect(describeError(new Error("x".repeat(1000))).length).toBe(300);
  });
});
