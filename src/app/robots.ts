import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://learningloop.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/practice", "/profile", "/history", "/settings", "/institute"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
