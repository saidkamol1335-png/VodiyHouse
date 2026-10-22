import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ComplexCreateForm } from "@/components/ComplexCreateForm";
import { ComplexList } from "@/components/ComplexList";
import { ComplexStatus } from "@/components/ComplexStatus";
import { DEV_VIEWER, type CabinetViewer } from "@/lib/admin/access";
import { DEMO_COMPLEX_ROWS, DEMO_DEVELOPER_OPTIONS } from "@/lib/admin/complexes/demo";
import { demoComplex, demoReadiness } from "@/lib/admin/complexes/demoPage";
import { complexListScope } from "@/lib/admin/complexes/list";
import { tabsNeedingAttention } from "@/lib/admin/complexes/readiness";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import {
  COMPLEX_TABS,
  canOpenComplex,
  complexAccess,
  complexTabRedirect,
  complexTabs,
} from "@/lib/admin/complexes/tabs";
import { cabinetPerson } from "@/lib/admin/person";
import { ROUTES } from "@/lib/routes";
import { demoCreateComplexAction, demoSetComplexStatusAction } from "./actions";

// Стенды «ЖК» на DEMO мокапа по ролям: /dev/zhk — руководитель, /dev/menedzher/zhk — менеджер
// (Н2). Те же компоненты и те же правила роли (complexAccess, unitsActionsFor), что у /admin/zhk,
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

/**
 * Вкладка, закрытая роли стенда, перекидывает на открытую — как complexForTab у /admin (Н2).
 * segment null — «Основное»; неизвестная или открытая (у неё своя страница) — 404.
 */
export function redirectStandTab(stand: ComplexStand, id: string, segment: string | null): never {
  devOnlyStand();
  const tab = COMPLEX_TABS.find((item) => item.segment === segment);
  const target = tab ? complexTabRedirect(stand.viewer.role, `${stand.base}/${id}`, tab.key) : null;
  if (!target) notFound();
  redirect(target);
}

type ComplexesStandProps = { stand: ComplexStand; scopeId: unknown };

/** Список «ЖК»: руководителю — с «+ Добавить ЖК» и статусами, менеджеру — только наличие. */
export async function ComplexesStand({ stand, scopeId }: ComplexesStandProps) {
  devOnlyStand();
  const person = await cabinetPerson(stand.viewer);
  const t = await getTranslations("admin.complexes");
  const access = complexAccess(stand.viewer.role);
  const scope = access.manage
    ? complexListScope(scopeId, DEMO_DEVELOPER_OPTIONS, DEMO_COMPLEX_ROWS)
    : { developer: null, archived: false };
  const subtitle = `DEMO · служебная страница · ${person.roleLabel}`;
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
        />
      </AdminPage>
    </AdminShell>
  );
}

type ComplexStandLayoutProps = { stand: ComplexStand; id: string; children: ReactNode };

/** Страница ЖК: у руководителя — статус, готовность и вкладки; у менеджера — только вкладка. */
export async function ComplexStandLayout({ stand, id, children }: ComplexStandLayoutProps) {
  devOnlyStand();
  const complex = demoComplex(id);
  const access = complexAccess(stand.viewer.role);
  if (!complex || !canOpenComplex(access, complex.status)) notFound();
  const person = await cabinetPerson(stand.viewer);
  const t = await getTranslations("admin.complexes");
  const subtitle = t("entitySubtitle", {
    developer: complex.developerName,
    address: `${ROUTES.catalog}/${complex.slug}`,
  });
  const topbar = (
    <AdminTopbar
      title={t("namePrefixed", { name: complex.name.ru })}
      subtitle={`${subtitle} · DEMO`}
      person={person}
    />
  );
  return (
    <AdminShell viewer={stand.viewer}>
      <AdminPage topbar={topbar}>
        {access.manage ? (
          <StandHead complex={complex} base={`${stand.base}/${complex.id}`} />
        ) : null}
        {children}
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
  );
  return (
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
  );
}
