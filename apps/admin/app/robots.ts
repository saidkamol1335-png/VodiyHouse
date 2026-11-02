import type { MetadataRoute } from "next";

// admin.vodiyhouse.uz закрыт от поиска целиком (PLAN §10).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
