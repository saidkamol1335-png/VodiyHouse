import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SITE_FAQ_KEY } from "@vh/shared/faq";
import { AdminPanel } from "@/components/AdminPanel";
import { ComplexFaqForm } from "@/components/ComplexFaqForm";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { saveSiteFaqAction } from "@/lib/admin/actions/siteFaq";
import { faqDrafts } from "@/lib/admin/complexes/faq";
import { settingsTabRedirect } from "@/lib/admin/nav";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Настройки → Частые вопросы» (правки 15.11, п. 7 + 23): общие вопросы Vodiy House для сайта. */
export default async function SettingsFaqPage() {
  const { viewer, allowed } = await requireSection("settings");
  if (!allowed) return null;
  const elsewhere = settingsTabRedirect(viewer.role, "faq");
  if (elsewhere) redirect(elsewhere);
  const t = await getTranslations("admin");
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return <AdminPanel title={t("siteFaq.title")}>{t("developers.errors.notConfigured")}</AdminPanel>;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("settings").select("value").eq("key", SITE_FAQ_KEY).maybeSingle();
  if (error) throw new Error("admin-site-faq-unavailable", { cause: error });
  return (
    <ComplexFaqForm
      faq={faqDrafts(data?.value ?? [])}
      action={saveSiteFaqAction}
      texts={{ title: t("siteFaq.title"), lead: t("siteFaq.lead") }}
    />
  );
}
