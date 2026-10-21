import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { JournalList } from "@/components/JournalList";
import { DEMO_DEVELOPER_ID, DEMO_JOURNAL, demoDeveloper } from "@/lib/admin/developers/demo";
import { journalPage } from "@/lib/admin/journal/format";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Журнал» на DEMO: правки DEMO-руководителя мокапа. */
export default async function DevDeveloperJournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const developer = demoDeveloper((await params).id);
  if (!developer) notFound();
  const t = await getTranslations("admin");
  const page = journalPage(developer.id === DEMO_DEVELOPER_ID ? DEMO_JOURNAL : []);
  return (
    <AdminPanel title={t("developers.tabs.log")} wide>
      <p className="admin-panel__lead">{t("developers.journalLead")}</p>
      <JournalList page={page} scope={{ developerId: developer.id, complexId: null }} load={null} />
    </AdminPanel>
  );
}
