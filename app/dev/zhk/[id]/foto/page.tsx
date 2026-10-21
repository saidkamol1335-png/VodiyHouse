import { notFound } from "next/navigation";
import { ComplexPhotos } from "@/components/ComplexPhotos";
import { demoComplex } from "@/lib/admin/complexes/demoPage";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Фото» на DEMO: фото у DEMO нет (рендеры — от застройщика), загрузки — в браузере. */
export default async function DevComplexPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return (
    <ComplexPhotos
      key={complex.id}
      complexId={complex.id}
      published={complex.status === "published"}
      photos={[]}
      actions={null}
    />
  );
}
