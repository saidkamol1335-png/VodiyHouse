import { notFound } from "next/navigation";
import { DeveloperPrivateForm } from "@/components/DeveloperPrivateForm";
import { DEMO_PRIVATE, demoDeveloper } from "@/lib/admin/developers/demo";
import { demoSavePrivateAction } from "../../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Внутреннее» на DEMO: контактов застройщика у DEMO нет — их не выдумываем. */
export default async function DevDeveloperPrivatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const developer = demoDeveloper((await params).id);
  if (!developer) notFound();
  return (
    <DeveloperPrivateForm
      developerId={developer.id}
      notes={DEMO_PRIVATE}
      action={demoSavePrivateAction}
    />
  );
}
