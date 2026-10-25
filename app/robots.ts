import type { MetadataRoute } from "next";
import { isIndexingClosed } from "@/lib/site/indexing";

// Кабинет и стенды поисковикам не нужны; тестовый деплой закрыт целиком (Ф2). Sitemap — шаг SEO фазы 3.
export default function robots(): MetadataRoute.Robots {
  if (isIndexingClosed()) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dev"] } };
}
