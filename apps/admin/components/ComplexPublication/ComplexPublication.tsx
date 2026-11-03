import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { ComplexPreviewTab } from "@/components/ComplexPreviewTab";
import { ComplexReadiness } from "@/components/ComplexReadiness";
import { ComplexSiteState } from "@/components/ComplexSiteState";
import { ComplexStatus } from "@/components/ComplexStatus";
import { JournalList } from "@/components/JournalList";
import { PublicationRequests } from "@/components/PublicationRequests";
import type { ComplexCompleteness, ComplexSiteState as SiteState } from "@/lib/admin/complexes/completeness";
import type { ReadinessItem } from "@/lib/admin/complexes/readiness";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import type { PublicationRequest } from "@/lib/admin/complexes/requests";
import type { ComplexAccess } from "@/lib/admin/complexes/tabs";
import type { ComplexFilePreview } from "@/lib/admin/complexes/types";
import type { JournalPage } from "@/lib/admin/journal/format";

type Actions = {
  setStatus: ComponentProps<typeof ComplexStatus>["action"];
  requests: ComponentProps<typeof PublicationRequests>["actions"];
  preview: ComponentProps<typeof ComplexPreviewTab>["link"];
  loadJournal: ComponentProps<typeof JournalList>["load"];
};

type ComplexPublicationProps = {
  complex: ComplexRecord;
  access: ComplexAccess;
  viewerId: string;
  /** Адрес страницы ЖК: пункты чек-листа ведут на вкладки. */
  base: string;
  readiness: readonly ReadinessItem[];
  completeness: ComplexCompleteness | null;
  /** Состояние, когда полноты нет (служебный стенд). */
  state: SiteState;
  files: readonly ComplexFilePreview[];
  requests: readonly PublicationRequest[];
  journal: JournalPage;
  finishings: Readonly<Record<number, string>>;
  developer: { name: string; published: boolean; href: string } | null;
  siteHref: string;
  actions: Actions;
};

/**
 * Вкладка «Публикация» (экран 3, PLAN §10 пп. 21, 25): состояние на сайте, чек-лист 6 пунктов,
 * кнопки по роли — руководитель публикует, скрывает, архивирует и отвечает на запросы, менеджер
 * просит его; предпросмотр 390/1440 и журнал изменений ЖК.
 */
export function ComplexPublication(props: ComplexPublicationProps) {
  const t = useTranslations("admin.complexes");
  const { complex, completeness, developer } = props;
  return (
    <>
      <AdminPanel title={t("publication.stateTitle")} wide>
        <ComplexSiteState
          status={complex.status}
          state={completeness?.state ?? props.state}
          developerPublished={developer?.published ?? false}
          siteHref={props.siteHref}
          completeness={completeness}
        />
      </AdminPanel>
      <AdminPanel title={t("publication.checklistTitle")} wide>
        <ComplexReadiness
          items={props.readiness}
          base={props.base}
          developerHref={developer?.href ?? null}
          completeness={completeness}
          defaultOpen
        />
      </AdminPanel>
      <ActionsPanel {...props} />
      <ComplexPreviewTab key={complex.id} complexId={complex.id} link={props.actions.preview} />
      <AdminPanel title={t("publication.journalTitle")} wide>
        <p className="admin-panel__lead">{t("journalLead")}</p>
        <JournalList
          page={props.journal}
          scope={{ developerId: null, complexId: complex.id }}
          load={props.actions.loadJournal}
          finishings={props.finishings}
        />
      </AdminPanel>
    </>
  );
}

/** Кнопки по роли: руководителю — капсула статуса и ответ на запрос, менеджеру — запрос. */
function ActionsPanel({ complex, access, completeness, developer, ...props }: ComplexPublicationProps) {
  const t = useTranslations("admin.complexes");
  return (
    <AdminPanel title={t("publication.actionsTitle")} wide>
      {access.publish ? (
        <ComplexStatus
          complex={{ ...complex, name: complex.name.ru }}
          action={props.actions.setStatus}
          readiness={props.readiness}
          completeness={completeness}
          files={props.files}
          base={props.base}
          developer={developer}
          withReadiness={false}
        />
      ) : null}
      <PublicationRequests
        complex={complex}
        role={access.publish ? "head" : "manager"}
        viewerId={props.viewerId}
        requests={props.requests}
        actions={props.actions.requests}
      />
    </AdminPanel>
  );
}
