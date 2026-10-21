import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { JournalList } from "@/components/JournalList";
import { loadJournalAction } from "@/lib/admin/actions/journal";
import { developerForTab } from "@/lib/admin/server/developerTab";
import { readJournal } from "@/lib/admin/server/developers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Журнал»: кто и когда менял застройщика. */
export default async function DeveloperJournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const developer = await developerForTab(params);
  if (!developer) return null;
  const t = await getTranslations("admin");
  const scope = { developerId: developer.id, complexId: null };
  const page = await readJournal(await createSupabaseServerClient(), scope);
  return (
    <AdminPanel title={t("developers.tabs.log")} wide>
      <p className="admin-panel__lead">{t("developers.journalLead")}</p>
      <JournalList page={page} scope={scope} load={loadJournalAction} />
    </AdminPanel>
  );
}
