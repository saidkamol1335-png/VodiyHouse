import type { MetadataRoute } from "next";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { siteOrigin } from "@/lib/site/metadata";
import { buildSitemap } from "@/lib/site/seo/sitemap";

// sitemap.xml (шаг 3.14): из того же кэша каталога, что и страницы, — правка ЖК в кабинете
// обновляет и карту. База не ответила — карта без ЖК, а не ошибка.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await readSiteCatalog();
  return buildSitemap(siteOrigin(), (catalog?.complexes ?? []).map((complex) => complex.slug));
}
