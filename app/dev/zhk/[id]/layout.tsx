import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ComplexStatus } from "@/components/ComplexStatus";
import { DEV_VIEWER } from "@/lib/admin/access";
import { demoComplex, demoReadiness } from "@/lib/admin/complexes/demoPage";
import { tabsNeedingAttention } from "@/lib/admin/complexes/readiness";
import { complexTabs } from "@/lib/admin/complexes/tabs";
import { cabinetPerson } from "@/lib/admin/person";
import { ROUTES } from "@/lib/routes";
import { demoSetComplexStatusAction } from "../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

type DevComplexLayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

// Стенд страницы ЖК: вкладки-адреса, статус и готовность, как у /admin/zhk/<id>.
export default async function DevComplexLayout({ children, params }: DevComplexLayoutProps) {
  if (process.env.NODE_ENV === "production") notFound();
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin.complexes");
  const base = `/dev/zhk/${complex.id}`;
  const readiness = demoReadiness(complex);
  const unpublished = complex.status === "draft" || complex.status === "hidden";
  const tabs = complexTabs(
    base,
    (key) => t(`tabs.${key}`),
    unpublished ? tabsNeedingAttention(readiness) : undefined,
  );
  const subtitle = t("entitySubtitle", {
    developer: complex.developerName,
    address: `${ROUTES.catalog}/${complex.slug}`,
  });
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar
            title={t("namePrefixed", { name: complex.name.ru })}
            subtitle={`${subtitle} · DEMO`}
            person={person}
          />
        }
      >
        <AdminEntityHead
          status={complex.status}
          tabsLabel={t("tabs.label")}
          tabs={tabs}
          attentionLabel={t("attention")}
          statusControls={
            <ComplexStatus
              complex={{ ...complex, name: complex.name.ru }}
              action={demoSetComplexStatusAction}
              readiness={readiness}
              files={[]}
              base={base}
              developer={{
                name: complex.developerName,
                published: complex.developerStatus === "published",
                href: `/dev/zastroyshchiki/${complex.developerId}`,
              }}
            />
          }
        />
        {children}
      </AdminPage>
    </AdminShell>
  );
}
