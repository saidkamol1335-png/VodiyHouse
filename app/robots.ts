import type { MetadataRoute } from "next";
import { isIndexingClosed } from "@/lib/site/indexing";
import { siteOrigin } from "@/lib/site/metadata";

// Кабинет и стенды поисковикам не нужны. Тестовый деплой закрыт целиком (Ф2) заголовком
// X-Robots-Tag: noindex на каждом ответе — обход ему не запрещаем: страницу, закрытую в robots.txt,
// поисковик не читает, noindex не видит и может взять в выдачу по одному адресу. Карту сайта
// закрытому сайту не объявляем.
export default function robots(): MetadataRoute.Robots {
  if (isIndexingClosed()) return { rules: { userAgent: "*", allow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dev"] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
