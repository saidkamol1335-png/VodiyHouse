import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ComplexCreateForm } from "@/components/ComplexCreateForm";
import { ComplexList } from "@/components/ComplexList";
import { DEV_VIEWER } from "@/lib/admin/access";
import { DEMO_COMPLEX_ROWS, DEMO_DEVELOPER_OPTIONS } from "@/lib/admin/complexes/demo";
import { complexListScope } from "@/lib/admin/complexes/list";
import { cabinetPerson } from "@/lib/admin/person";
import { demoCreateComplexAction } from "./actions";

export const instant = false;

type DevComplexesPageProps = { searchParams: Promise<{ zastroyshchik?: string | string[] }> };

// Стенд «ЖК» (шаг 11) на DEMO мокапа: те же компоненты, что у /admin/zhk, без базы.
// В продакшене страницы нет.
export default async function DevComplexesPage({ searchParams }: DevComplexesPageProps) {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin.complexes");
  const scope = complexListScope(
    (await searchParams).zastroyshchik,
    DEMO_DEVELOPER_OPTIONS,
    DEMO_COMPLEX_ROWS,
  );
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar title={t("title")} subtitle="DEMO · служебная страница" person={person} />
        }
      >
        <ComplexCreateForm
          action={demoCreateComplexAction}
          developers={DEMO_DEVELOPER_OPTIONS}
          developerId={scope.archived ? undefined : scope.developer?.id}
          developersHref="/dev/zastroyshchiki"
        />
        <ComplexList
          key={scope.developer?.id ?? "all"}
          rows={DEMO_COMPLEX_ROWS}
          baseHref="/dev/zhk"
          developer={scope.developer}
          initialFilter={scope.archived ? "archived" : "all"}
        />
      </AdminPage>
    </AdminShell>
  );
}
