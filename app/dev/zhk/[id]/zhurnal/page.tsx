import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { JournalList } from "@/components/JournalList";
import { DEMO_COMPLEX_JOURNAL } from "@/lib/admin/complexes/demoJournal";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { journalPage } from "@/lib/admin/journal/format";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Журнал» на DEMO: правки Shodlik руководителем мокапа. */
export default async function DevComplexJournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const t = await getTranslations("admin.complexes");
  const page = journalPage(complex.slug === "demo-shodlik" ? DEMO_COMPLEX_JOURNAL : []);
  return (
    <AdminPanel title={t("tabs.log")} wide>
      <p className="admin-panel__lead">{t("journalLead")}</p>
      <JournalList page={page} scope={{ developerId: null, complexId: complex.id }} load={null} />
    </AdminPanel>
  );
}
