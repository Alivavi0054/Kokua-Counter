import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export const PUBLIC_PATHS = ["/", "/about", "/donate", "/school/register", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl().origin;
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/donate" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/donate" ? 0.9 : 0.6,
  }));
}
