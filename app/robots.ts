import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// Private areas are protected by sign-in; this only keeps them out of search results.
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().origin;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/student", "/eatery", "/api/", "/auth/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
