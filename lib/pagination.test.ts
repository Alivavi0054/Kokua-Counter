import { describe, expect, it } from "vitest";
import { orIlike, pageRange, parseListParams, sanitizeSearch, totalPages } from "@/lib/pagination";

describe("pagination helpers", () => {
  it("parses and clamps the page number", () => {
    expect(parseListParams({}).page).toBe(1);
    expect(parseListParams({ page: "3" }).page).toBe(3);
    for (const bad of ["0", "-5", "abc", "", "NaN", "1e9999"]) expect(parseListParams({ page: bad }).page, bad).toBeGreaterThanOrEqual(1);
    expect(parseListParams({ page: "999999999" }).page).toBe(10_000);
  });

  it("computes row ranges and page counts", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 24 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 });
    expect(totalPages(0)).toBe(1);
    expect(totalPages(25)).toBe(1);
    expect(totalPages(26)).toBe(2);
    expect(totalPages(100, 10)).toBe(10);
  });

  it("strips characters that could alter a PostgREST filter", () => {
    expect(sanitizeSearch("kai%,name.eq.x)")).toBe("kainame.eq.x");
    expect(sanitizeSearch("a_b*c\\d(e)")).toBe("abcde");
    expect(sanitizeSearch("  Poi   Shack ")).toBe("Poi Shack");
    // the ʻokina is a letter, so Hawaiian names survive
    expect(sanitizeSearch("Kōkua ʻOhana")).toBe("Kōkua ʻOhana");
    expect(sanitizeSearch("lei@hawaii.edu")).toBe("lei@hawaii.edu");
    expect(sanitizeSearch("x".repeat(500))).toHaveLength(60);
    expect(sanitizeSearch(undefined)).toBe("");
  });

  it("builds an or-filter from sanitized text only", () => {
    const q = sanitizeSearch("poi,is_active.eq.false");
    expect(q).toBe("poiisactive.eq.false");
    expect(orIlike(["name", "island"], q)).toBe("name.ilike.%poiisactive.eq.false%,island.ilike.%poiisactive.eq.false%");
  });
});
