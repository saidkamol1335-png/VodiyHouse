import { notFound } from "next/navigation";
import { DeveloperMainForm } from "@/components/DeveloperMainForm";
import { demoDeveloper } from "@/lib/admin/developers/demo";
import { demoSaveMainAction } from "../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Основное» на DEMO: фото остаются в браузере (без облака). */
export default async function DevDeveloperMainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const developer = demoDeveloper((await params).id);
  if (!developer) notFound();
  return (
    <DeveloperMainForm
      key={developer.id}
      developer={developer}
      action={demoSaveMainAction}
      media={{ logo: null, cover: null }}
      mediaActions={null}
    />
  );
}
