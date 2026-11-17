import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ABOUT_HISTORY_KEY, ABOUT_TEAM_KEY, aboutHistoryFrom, aboutTeamFrom } from "@vh/shared/about";
import { AboutHistoryForm } from "@/components/AboutHistoryForm";
import { AboutTeamForm } from "@/components/AboutTeamForm";
import { AdminPanel } from "@/components/AdminPanel";
import { historyDrafts, teamDrafts } from "@/lib/admin/about/forms";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { saveAboutHistoryAction, saveAboutTeamAction } from "@/lib/admin/actions/about";
import { settingsTabRedirect } from "@/lib/admin/nav";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Настройки → О компании» (правки 15.11, п. 25): «История» и «Команда» страницы «О нас» сайта. */
export default async function SettingsAboutPage() {
  const { viewer, allowed } = await requireSection("settings");
  if (!allowed) return null;
  const elsewhere = settingsTabRedirect(viewer.role, "about");
  if (elsewhere) redirect(elsewhere);
  const t = await getTranslations("admin");
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return <AdminPanel title={t("about.title")}>{t("developers.errors.notConfigured")}</AdminPanel>;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("settings").select("key, value").in("key", [ABOUT_HISTORY_KEY, ABOUT_TEAM_KEY]);
  if (error) throw new Error("admin-about-unavailable", { cause: error });
  const value = (key: string) => data?.find((row) => row.key === key)?.value;
  return (
    <>
      <AboutHistoryForm events={historyDrafts(aboutHistoryFrom(value(ABOUT_HISTORY_KEY)))} action={saveAboutHistoryAction} />
      <AboutTeamForm members={teamDrafts(aboutTeamFrom(value(ABOUT_TEAM_KEY)))} action={saveAboutTeamAction} />
    </>
  );
}
