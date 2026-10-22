import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { JournalList } from "@/components/JournalList";
import { loadJournalAction } from "@/lib/admin/actions/journal";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { finishingNames } from "@/lib/admin/journal/format";
import { readDictionary, readJournal } from "@/lib/admin/server/developers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Журнал»: кто и когда менял ЖК, блоки, планировки и фото. */
export default async function ComplexJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "log");
  if (!complex) return null;
  const t = await getTranslations("admin.complexes");
  const scope = { developerId: null, complexId: complex.id };
  const supabase = await createSupabaseServerClient();
  const [page, finishings] = await Promise.all([
    readJournal(supabase, scope),
    readDictionary(supabase, "finishings"),
  ]);
  return (
    <AdminPanel title={t("tabs.log")} wide>
      <p className="admin-panel__lead">{t("journalLead")}</p>
      <JournalList
        page={page}
        scope={scope}
        load={loadJournalAction}
        finishings={finishingNames(finishings)}
      />
    </AdminPanel>
  );
}
