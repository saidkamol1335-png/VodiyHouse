import type { MetadataRoute } from "next";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { readSiteDevelopers } from "@/lib/site/developers/read";
import { siteOrigin } from "@/lib/site/metadata";
import { buildSitemap } from "@/lib/site/seo/sitemap";

// sitemap.xml (шаг 3.14): из тех же кэшей каталога и застройщиков, что и страницы, — правка в
// кабинете обновляет и карту. База не ответила — карта без ЖК и застройщиков, а не ошибка.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, developers] = await Promise.all([readSiteCatalog(), readSiteDevelopers()]);
  return buildSitemap(
    siteOrigin(),
    (catalog?.complexes ?? []).map((complex) => complex.slug),
    (developers ?? []).map((developer) => developer.slug),
  );
}
