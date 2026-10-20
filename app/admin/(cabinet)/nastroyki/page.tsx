import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { StaffList } from "@/components/StaffList";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { readStaffDirectory } from "@/lib/admin/server/deps";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Настройки → Сотрудники»: список из базы сессией руководителя (staff_directory). */
export default async function SettingsStaffPage() {
  // Layout не перерисовывается при переходах — страница проверяет доступ сама.
  const { viewer, allowed } = await requireSection("settings");
  if (!allowed) return null;
  if (isCabinetOpenWithoutLogin || !hasSupabaseAdminEnv()) {
    const t = await getTranslations("admin.staff");
    return <AdminPanel title={t("title")}>{t("notConfigured")}</AdminPanel>;
  }
  const members = await readStaffDirectory(await createSupabaseServerClient());
  return <StaffList members={members} viewerId={viewer.id} />;
}
