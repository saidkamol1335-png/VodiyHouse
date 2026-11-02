import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { DeveloperCreateForm } from "@/components/DeveloperCreateForm";
import { DeveloperList } from "@/components/DeveloperList";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { createDeveloperAction } from "@/lib/admin/actions/developers";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { readDeveloperRows } from "@/lib/admin/server/developers";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Застройщики» (Д1): только руководителю (PLAN §7). */
export default async function DevelopersPage() {
  const { viewer, allowed } = await requireSection("developers");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = (
    <AdminTopbar
      title={t("developers.title")}
      subtitle={t("developers.subtitle")}
      person={person}
    />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.developers")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={t("developers.title")}>
          {t("developers.errors.notConfigured")}
        </AdminPanel>
      </AdminPage>
    );
  }
  const rows = await readDeveloperRows(await createSupabaseServerClient());
  const items = rows.map((row) => ({
    ...row,
    logoSrc: row.logoPath ? mediaSrc(row.logoPath) : null,
  }));
  return (
    <AdminPage topbar={topbar}>
      <DeveloperCreateForm action={createDeveloperAction} />
      <DeveloperList rows={items} baseHref={ADMIN_ROUTES.developers} />
    </AdminPage>
  );
}
