import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { Button } from "@/components/Button";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { CatalogOrder } from "@/components/CatalogOrder";
import { ComplexCreateForm } from "@/components/ComplexCreateForm";
import { ComplexList } from "@/components/ComplexList";
import { ComplexPublication } from "@/components/ComplexPublication";
import { ComplexStateBadge } from "@/components/ComplexStateBadge";
import { ComplexWizardSteps } from "@/components/ComplexWizard";
import { DEV_VIEWER, type CabinetViewer } from "@/lib/admin/access";
import { DEMO_COMPLEX_ROWS, DEMO_DEVELOPER_OPTIONS } from "@/lib/admin/complexes/demo";
import { DEMO_COMPLEX_JOURNAL } from "@/lib/admin/complexes/demoJournal";
import { demoComplex, demoReadiness } from "@/lib/admin/complexes/demoPage";
import { catalogOrderOf, complexListScope } from "@/lib/admin/complexes/list";
import { tabsNeedingAttention } from "@/lib/admin/complexes/readiness";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import {
  canOpenComplex,
  complexAccess,
  complexTabHref,
  complexTabs,
} from "@/lib/admin/complexes/tabs";
import { SEED_DICTIONARIES } from "@/lib/admin/dictionaries/seed";
import { finishingNames, journalPage } from "@/lib/admin/journal/format";
import { cabinetPerson } from "@/lib/admin/person";
import { complexRoute, ROUTES } from "@/lib/routes";
import { siteOrigin } from "@/lib/site/metadata";
import {
  demoCreateComplexAction,
  demoDeleteComplexNowAction,
  demoRequestAction,
  demoSetComplexStatusAction,
} from "./actions";
import { demoPreviewLinkAction } from "./previewActions";

// Стенды «ЖК» на DEMO мокапа по ролям: /dev/zhk — руководитель, /dev/menedzher/zhk — менеджер
// (PLAN §10, п. 6: правит всё, публикует руководитель). Те же компоненты и те же правила роли (complexAccess, unitsActionsFor), что у /admin/zhk,
// без базы. В продакшене стендов нет.

const DEV_MANAGER: CabinetViewer = {
  id: "dev-manager",
  role: "manager",
  name: null,
  mustChangePassword: false,
};

export type ComplexStand = { viewer: CabinetViewer; base: string };

export const HEAD_STAND: ComplexStand = { viewer: DEV_VIEWER, base: "/dev/zhk" };
export const MANAGER_STAND: ComplexStand = { viewer: DEV_MANAGER, base: "/dev/menedzher/zhk" };

export function devOnlyStand() {
  if (process.env.NODE_ENV === "production") notFound();
}

type ComplexesStandProps = { stand: ComplexStand; scopeId: unknown };

/** Список «ЖК»: «+ Добавить ЖК» — обоим, действия в строке и «Порядок в каталоге» — руководителю. */
export async function ComplexesStand({ stand, scopeId }: ComplexesStandProps) {
  devOnlyStand();
  const person = await cabinetPerson(stand.viewer);
  const t = await getTranslations("admin.complexes");
  const access = complexAccess(stand.viewer.role);
  const scope = access.manage
    ? complexListScope(scopeId, DEMO_DEVELOPER_OPTIONS, DEMO_COMPLEX_ROWS)
    : { developer: null, archived: false };
  const tDev = await getTranslations("admin.dev");
  const subtitle = tDev("subtitleRole", { role: person.roleLabel });
  return (
    <AdminShell viewer={stand.viewer}>
      <AdminPage topbar={<AdminTopbar title={t("title")} subtitle={subtitle} person={person} />}>
        {access.manage ? (
          <ComplexCreateForm
            action={demoCreateComplexAction}
            developers={DEMO_DEVELOPER_OPTIONS}
            developerId={scope.archived ? undefined : scope.developer?.id}
            developersHref="/dev/zastroyshchiki"
          />
        ) : null}
        <ComplexList
          key={scope.developer?.id ?? "all"}
          rows={DEMO_COMPLEX_ROWS}
          baseHref={stand.base}
          developer={scope.developer}
          initialFilter={scope.archived ? "archived" : "all"}
          access={access}
          actions={access.publish ? { setStatus: demoSetComplexStatusAction, deleteNow: demoDeleteComplexNowAction } : null}
        />
        {access.publish ? <CatalogOrder complexes={catalogOrderOf(DEMO_COMPLEX_ROWS)} action={null} /> : null}
      </AdminPage>
    </AdminShell>
  );
}

type ComplexStandLayoutProps = { stand: ComplexStand; id: string; children: ReactNode };

/** Страница ЖК: значок состояния, «Квартиры» и вкладки — у руководителя и менеджера одинаково. */
export async function ComplexStandLayout({ stand, id, children }: ComplexStandLayoutProps) {
  devOnlyStand();
  const complex = demoComplex(id);
  const access = complexAccess(stand.viewer.role);
  if (!complex || !canOpenComplex(access, complex.status)) notFound();
  const person = await cabinetPerson(stand.viewer);
  const t = await getTranslations("admin.complexes");
  const tDev = await getTranslations("admin.dev");
  const subtitle = t("entitySubtitle", {
    developer: complex.developerName,
    address: `${ROUTES.catalog}/${complex.slug}`,
  });
  const topbar = (
    <AdminTopbar
      title={t("namePrefixed", { name: complex.name.ru })}
      subtitle={tDev("demoSuffix", { text: subtitle })}
      person={person}
    />
  );
  return (
    <AdminShell viewer={stand.viewer}>
      <AdminPage topbar={topbar}>
        <StandHead complex={complex} base={`${stand.base}/${complex.id}`} />
        {children}
        {access.manage && complex.status === "draft" ? <ComplexWizardSteps base={`${stand.base}/${complex.id}`} /> : null}
      </AdminPage>
    </AdminShell>
  );
}

async function StandHead({ complex, base }: { complex: ComplexRecord; base: string }) {
  const t = await getTranslations("admin.complexes");
  const readiness = demoReadiness(complex);
  const unpublished = complex.status === "draft" || complex.status === "hidden";
  const tabs = complexTabs(
    base,
    (key) => t(`tabs.${key}`),
    unpublished ? tabsNeedingAttention(readiness) : undefined,
    complex.status === "draft",
  );
  const done = readiness.filter((item) => item.ok).length;
  return (
    <AdminEntityHead
      status={complex.status}
      tabsLabel={t("tabs.label")}
      tabs={tabs}
      attentionLabel={t("attention")}
      statusControls={
        <div className="admin-entity-head__state">
          <ComplexStateBadge
            status={complex.status}
            siteState={{ state: done === readiness.length ? "full" : "draft", done, total: readiness.length }}
            developerPublished={complex.developerStatus === "published"}
            size="md"
          />
          <Button size="sm" variant="outline" href={complexTabHref(base, "units")}>
            {t("tabs.units")}
          </Button>
        </div>
      }
    />
  );
}

/** «Публикация» на DEMO: тот же экран, что у кабинета; кнопки — по роли стенда. */
export async function StandPublication({ stand, id }: { stand: ComplexStand; id: string }) {
  devOnlyStand();
  const complex = demoComplex(id);
  const access = complexAccess(stand.viewer.role);
  if (!complex || !canOpenComplex(access, complex.status)) notFound();
  const readiness = demoReadiness(complex);
  return (
    <ComplexPublication
      complex={complex}
      access={access}
      viewerId={stand.viewer.id}
      base={`${stand.base}/${complex.id}`}
      readiness={readiness}
      completeness={null}
      state={readiness.every((item) => item.ok) ? "full" : "draft"}
      files={[]}
      requests={[]}
      journal={journalPage(complex.slug === "demo-shodlik" ? DEMO_COMPLEX_JOURNAL : [])}
      finishings={finishingNames(SEED_DICTIONARIES.finishings)}
      developer={{
        name: complex.developerName,
        published: complex.developerStatus === "published",
        href: `/dev/zastroyshchiki/${complex.developerId}`,
      }}
      siteHref={`${siteOrigin()}/ru${complexRoute(complex.slug)}`}
      actions={{
        setStatus: demoSetComplexStatusAction,
        requests: access.publish
          ? { request: null, cancel: null, decline: demoRequestAction }
          : { request: demoRequestAction, cancel: demoRequestAction, decline: null },
        preview: demoPreviewLinkAction,
        loadJournal: null,
      }}
    />
  );
}
