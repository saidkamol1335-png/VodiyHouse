import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { JournalList } from "@/components/JournalList";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { loadJournalAction } from "@/lib/admin/actions/journal";
import { finishingNames, WHOLE_JOURNAL } from "@/lib/admin/journal/format";
import { readDictionary, readJournal } from "@/lib/admin/server/developers";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Настройки → Журнал»: все изменения в кабинете, от новых к старым (ТЗ 13.1). */
export default async function SettingsJournalPage() {
  const { allowed } = await requireSection("settings");
  if (!allowed) return null;
  const t = await getTranslations("admin");
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPanel title={t("journal.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
    );
  }
  const supabase = await createSupabaseServerClient();
  const [page, finishings] = await Promise.all([
    readJournal(supabase, WHOLE_JOURNAL),
    readDictionary(supabase, "finishings"),
  ]);
  return (
    <AdminPanel title={t("journal.title")} wide>
      <p className="admin-panel__lead">{t("journal.lead")}</p>
      <JournalList
        page={page}
        scope={WHOLE_JOURNAL}
        load={loadJournalAction}
        finishings={finishingNames(finishings)}
      />
    </AdminPanel>
  );
}
