import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ComplexCreateForm } from "@/components/ComplexCreateForm";
import { ComplexList } from "@/components/ComplexList";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { createComplexAction } from "@/lib/admin/actions/complexes";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { readComplexRows, readDeveloperOptions } from "@/lib/admin/server/complexes";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexesPageProps = { searchParams: Promise<{ zastroyshchik?: string | string[] }> };

/** «ЖК» (в. 5): до шага 12 — только руководителю, потом и менеджеру (вкладка «Квартиры»). */
export default async function ComplexesPage({ searchParams }: ComplexesPageProps) {
  const { viewer, allowed } = await requireSection("complexes");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = (
    <AdminTopbar title={t("complexes.title")} subtitle={t("complexes.subtitle")} person={person} />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.complexes")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={t("complexes.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
      </AdminPage>
    );
  }
  const supabase = await createSupabaseServerClient();
  const [rows, developers] = await Promise.all([
    readComplexRows(supabase),
    readDeveloperOptions(supabase),
  ]);
  const scopeId = (await searchParams).zastroyshchik;
  const scope = developers.find((developer) => developer.id === scopeId) ?? null;
  return (
    <AdminPage topbar={topbar}>
      <ComplexCreateForm
        action={createComplexAction}
        developers={developers}
        developerId={scope?.id}
        developersHref={ADMIN_ROUTES.developers}
      />
      <ComplexList rows={rows} baseHref={ADMIN_ROUTES.complexes} developer={scope} />
    </AdminPage>
  );
}
