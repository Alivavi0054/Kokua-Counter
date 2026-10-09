import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap, { PUBLIC_PATHS } from "@/app/sitemap";
import { getSiteUrl } from "@/lib/site";
import { vi } from "vitest";

describe("seo routes", () => {
  it("sitemap lists only public pages on the configured origin", () => {
    vi.stubEnv("APP_URL", "https://kokuacounter.app");
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://kokuacounter.app");
    expect(urls).toContain("https://kokuacounter.app/donate");
    expect(urls).toHaveLength(PUBLIC_PATHS.length);
    for (const url of urls) expect(url).not.toMatch(/\/(admin|student|eatery|api|auth)(\/|$)/);
    vi.unstubAllEnvs();
  });

  it("robots keeps private areas out of search and points at the sitemap", () => {
    vi.stubEnv("APP_URL", "https://kokuacounter.app");
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/student", "/eatery", "/api/", "/auth/"]));
    expect(result.sitemap).toBe("https://kokuacounter.app/sitemap.xml");
    vi.unstubAllEnvs();
  });

  it("falls back safely when APP_URL is missing or invalid", () => {
    vi.stubEnv("APP_URL", "not a url");
    expect(getSiteUrl().origin).toBe("http://localhost:3000");
    vi.stubEnv("APP_URL", "");
    expect(getSiteUrl().origin).toBe("http://localhost:3000");
    vi.unstubAllEnvs();
  });
});
