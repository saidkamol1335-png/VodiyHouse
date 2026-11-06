import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { FilterArchiveBoard } from "@/components/FilterArchiveBoard";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { setFilterArchiveAction } from "@/lib/admin/actions/filterArchive";
import { filterArchiveGroups } from "@/lib/admin/filterArchive/groups";
import { settingsTabRedirect } from "@/lib/admin/nav";
import { readFilterArchive, readFilterCatalog } from "@/lib/admin/server/filterArchive";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Настройки → Фильтр сайта» (06.11.2026): архив кнопок фильтра каталога сайта. */
export default async function SettingsFilterPage() {
  const { viewer, allowed } = await requireSection("settings");
  if (!allowed) return null;
  const elsewhere = settingsTabRedirect(viewer.role, "filter");
  if (elsewhere) redirect(elsewhere);
  const t = await getTranslations("admin");
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPanel title={t("filterArchive.title")}>
        {t("developers.errors.notConfigured")}
      </AdminPanel>
    );
  }
  const supabase = await createSupabaseServerClient();
  const [archive, catalog] = await Promise.all([
    readFilterArchive(supabase),
    readFilterCatalog(supabase),
  ]);
  const groups = filterArchiveGroups(archive, catalog, {
    room: (rooms) =>
      rooms === 0
        ? t("filterArchive.rooms.studio")
        : rooms === 4
          ? t("filterArchive.rooms.many")
          : String(rooms),
    payment: (kind) => t(`filterArchive.payments.${kind}`),
    built: t("filterArchive.deadlineBuilt"),
    upTo: (year) => t("filterArchive.deadlineUpTo", { year }),
  });
  return (
    <FilterArchiveBoard
      groups={groups}
      catalogMissing={catalog === null}
      action={setFilterArchiveAction}
    />
  );
}
