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
import { createComplexAction, deleteComplexNowAction, setComplexStatusAction } from "@/lib/admin/actions/complexes";
import { catalogOrderOf, complexListScope } from "@/lib/admin/complexes/list";
import { complexAccess, type ComplexAccess } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { readComplexRows, readDeveloperOptions } from "@/lib/admin/server/complexes";
import { readPendingRequests } from "@/lib/admin/server/requests";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexesPageProps = { searchParams: Promise<{ zastroyshchik?: string | string[] }> };

/** Список ЖК (экран 2, PLAN §10 п. 23): создание и правка — руководителю и менеджеру, действия со статусом — руководителю. */
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
      <Complexes scopeId={(await searchParams).zastroyshchik} access={access} />
    </AdminPage>
  );
}

/** «+ Добавить ЖК» и список с вкладками, ?zastroyshchik= — ЖК застройщика; порядок каталога — руководителю. */
async function Complexes({ scopeId, access }: { scopeId: unknown; access: ComplexAccess }) {
  const supabase = await createSupabaseServerClient();
  const [rows, developers, requests] = await Promise.all([
    readComplexRows(supabase),
    readDeveloperOptions(supabase),
    readPendingRequests(supabase),
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
        initialFilter={scope.archived && access.publish ? "archived" : "all"}
        access={access}
        pending={new Set(requests.map((request) => request.complexId))}
        actions={access.publish ? { setStatus: setComplexStatusAction, deleteNow: deleteComplexNowAction } : null}
      />
      {access.publish ? <CatalogOrder complexes={catalogOrderOf(rows)} action={reorderComplexesAction} /> : null}
    </>
  );
}
