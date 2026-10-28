"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FacadeActions, FacadeTabData } from "@/lib/admin/facade/types";
import { BlockContours } from "./BlockContours";
import { FacadeImage } from "./FacadeImage";
import { FloorPlans } from "./FloorPlans";

type ComplexFacadeTabProps = {
  complexId: string;
  published: boolean;
  data: FacadeTabData;
  /** null — без облака: смотреть можно, сохранить нечего. */
  actions: FacadeActions | null;
};

/**
 * Вкладка ЖК «Фасад и планы» (фаза 4): фасад → контуры блоков → планы этажей с контурами квартир.
 * Всё сохраняется сразу; после сохранения страница перечитывает данные с сервера.
 */
export function ComplexFacadeTab({ complexId, published, data, actions }: ComplexFacadeTabProps) {
  const t = useTranslations("admin.complexes.facade");
  const router = useRouter();
  const refresh = () => router.refresh();
  if (!actions) return <p className="field__meta">{t("lead")}</p>;
  return (
    <div className="facade-tab">
      <p className="facade-tab__lead">{t("lead")}</p>
      <section className="facade-tab__section" aria-labelledby="facade-tab-image">
        <h2 id="facade-tab-image" className="facade-tab__title">
          {t("facade")}
        </h2>
        <FacadeImage complexId={complexId} published={published} facade={data.facade} actions={actions} onChanged={refresh} />
      </section>
      <section className="facade-tab__section" aria-labelledby="facade-tab-contours">
        <h2 id="facade-tab-contours" className="facade-tab__title">
          {t("contours")}
        </h2>
        <p className="field__meta">{data.facade ? t("contoursHint") : t("noFacade")}</p>
        {data.facade ? (
          <BlockContours key={data.facade.src} facade={data.facade} blocks={data.blocks} actions={actions} onChanged={refresh} />
        ) : null}
      </section>
      <section className="facade-tab__section" aria-labelledby="facade-tab-plans">
        <h2 id="facade-tab-plans" className="facade-tab__title">
          {t("plans")}
        </h2>
        <p className="field__meta">{t("plansHint")}</p>
        <FloorPlans complexId={complexId} published={published} blocks={data.blocks} plans={data.plans} actions={actions} onChanged={refresh} />
      </section>
    </div>
  );
}
