import { type JsonLd as JsonLdData, serializeJsonLd } from "@/lib/site/seo/jsonLd";

/** Разметка schema.org для поиска (шаг 3.14): скрипт-данные, браузер его не исполняет. */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
