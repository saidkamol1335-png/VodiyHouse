import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { CatalogOrder } from "@/components/CatalogOrder";
import { ComplexCreateForm } from "@/components/ComplexCreateForm";
import { ComplexList } from "@/components/ComplexList";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { reorderComplexesAction } from "@/lib/admin/actions/complexContent";
import { createComplexAction } from "@/lib/admin/actions/complexes";
import { catalogOrderOf, complexListScope } from "@/lib/admin/complexes/list";
import { complexAccess, type ComplexAccess } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { readComplexRows, readDeveloperOptions } from "@/lib/admin/server/complexes";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexesPageProps = { searchParams: Promise<{ zastroyshchik?: string | string[] }> };

/** «ЖК» (в. 5): руководителю — с созданием и статусами, менеджеру — список наличия (Н2). */
export default async function ComplexesPage({ searchParams }: ComplexesPageProps) {
  const { viewer, allowed } = await requireSection("complexes");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const access = complexAccess(viewer.role);
  const topbar = (
    <AdminTopbar
      title={t("complexes.title")}
      subtitle={t(allowed && !access.manage ? "complexes.subtitleStock" : "complexes.subtitle")}
      person={person}
    />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.complexes")} sectionKey="complexes" />
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
  return (
    <AdminPage topbar={topbar}>
      {access.manage ? (
        <HeadComplexes scopeId={(await searchParams).zastroyshchik} access={access} />
      ) : (
        <StockComplexes access={access} />
      )}
    </AdminPage>
  );
}

/** Менеджер: только наличие — без создания и «ЖК застройщика». */
async function StockComplexes({ access }: { access: ComplexAccess }) {
  const rows = await readComplexRows(await createSupabaseServerClient());
  return <ComplexList rows={rows} baseHref={ADMIN_ROUTES.complexes} access={access} />;
}

/** Руководитель: «+ Добавить ЖК» и список с пилюлями статусов, ?zastroyshchik= — ЖК застройщика. */
async function HeadComplexes({ scopeId, access }: { scopeId: unknown; access: ComplexAccess }) {
  const supabase = await createSupabaseServerClient();
  const [rows, developers] = await Promise.all([
    readComplexRows(supabase),
    readDeveloperOptions(supabase),
  ]);
  const scope = complexListScope(scopeId, developers, rows);
  return (
    <>
      <ComplexCreateForm
        action={createComplexAction}
        developers={developers}
        developerId={scope.archived ? undefined : scope.developer?.id}
        developersHref={ADMIN_ROUTES.developers}
      />
      {/* ?zastroyshchik= не сбрасывает состояние страницы (и Activity хранит её): ключ по области
          — список с новым начальным фильтром. */}
      <ComplexList
        key={scope.developer?.id ?? "all"}
        rows={rows}
        baseHref={ADMIN_ROUTES.complexes}
        developer={scope.developer}
        initialFilter={scope.archived ? "archived" : "all"}
        access={access}
      />
      <CatalogOrder complexes={catalogOrderOf(rows)} action={reorderComplexesAction} />
    </>
  );
}
