"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { ChoiceField } from "@/components/ChoiceField";
import type { MediaPreview } from "@/components/MediaDrop";
import { NEW_SHOWCASE_ID, showcaseListHref } from "@/lib/admin/nav";
import { Field } from "@/components/Field";
import { AD_CTAS, ADVERTISER_MAX, adFieldsOf, type AdErrors, type AdFields } from "@/lib/admin/showcase/adForm";
import { SHOWCASE_LIMITS } from "@/lib/admin/showcase/forms";
import type {
  AdRecord,
  DeleteShowcaseResult,
  FormAction,
  SaveShowcaseResult,
  ShowcaseMediaActions,
  ShowcaseOptions,
} from "@/lib/admin/showcase/types";
import { useShowcaseForm } from "@/lib/admin/showcase/useShowcaseForm";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { AdBanners } from "./AdBanners";
import { DeletePanel } from "./DeletePanel";
import { DeveloperSelect, OrderAndActive, PeriodFields, SaveRow } from "./ShowcaseParts";

export type AdFormProps = {
  record: AdRecord | null;
  options: ShowcaseOptions;
  action: FormAction<SaveShowcaseResult<AdFields, AdErrors>>;
  /** Картинки баннера: для ПК и для телефона (правки 15.11, п. 4 + 13). */
  banners: { banner: MediaPreview | null; bannerMobile: MediaPreview | null };
  mediaActions: ShowcaseMediaActions | null;
  deleteAction: FormAction<DeleteShowcaseResult> | null;
  base: string;
};

/**
 * Реклама — баннер (правки 15.11, п. 4 + 13): застройщик или другой рекламодатель (20.11), название, кнопка (телефон Vodiy House или
 * заявка), период, порядок в слайдере и каталоге; под формой — картинки для ПК и телефона с отметкой
 * правила 1.2 на каждую загрузку и «Удалить».
 */
export function AdForm(props: AdFormProps) {
  const t = useTranslations("admin.showcase.form");
  const tIssue = useTranslations("admin.showcase.issues");
  const { state, formAction, pending, failed } = useShowcaseForm(props.action);
  const fields = failed?.fields ?? adFieldsOf(props.record);
  const issue: Issue = (field) => {
    const code = failed?.fieldErrors[field];
    return code ? tIssue(code) : undefined;
  };
  const [developerId, setDeveloperId] = useState(fields.developerId);
  const { record } = props;
  return (
    <AdminPanel title={record ? t("editTitle.ad") : t("newTitle.ad")} wide>
      <form className="showcase-form" onSubmit={submitKeepingForm(formAction)} noValidate>
        <input type="hidden" name="id" value={record?.id ?? NEW_SHOWCASE_ID} />
        <AdAdvertiser fields={fields} developers={props.options.developers} developerId={developerId} onDeveloper={setDeveloperId} issue={issue} />
        <AdTitleAndCta fields={fields} issue={issue} />
        <PeriodFields idPrefix="ad" validFrom={fields.validFrom} validTo={fields.validTo} issue={issue} />
        <OrderAndActive idPrefix="ad" sort={fields.sort} isActive={fields.isActive} issue={issue} />
        <SaveRow state={state} pending={pending} isNew={!record} backHref={showcaseListHref("ad", props.base)} />
      </form>
      {record ? (
        <>
          <AdBanners id={record.id} initial={props.banners} actions={props.mediaActions} />
          {props.deleteAction ? <DeletePanel kind="ad" id={record.id} name={record.title.ru} action={props.deleteAction} /> : null}
        </>
      ) : (
        <p className="field__meta">{t("bannerNew")}</p>
      )}
    </AdminPanel>
  );
}

type Issue = (field: keyof AdFields) => string | undefined;

type AdAdvertiserProps = {
  fields: AdFields;
  developers: ShowcaseOptions["developers"];
  developerId: string;
  onDeveloper: (id: string) => void;
  issue: Issue;
};

/**
 * Рекламодатель (правки 15.11, п. 4, 20.11): застройщик из списка или другая компания — названием.
 * Подпись баннера на сайте — название, иначе имя застройщика; кнопка — всё равно Vodiy House (1.2).
 */
function AdAdvertiser({ fields, developers, developerId, onDeveloper, issue }: AdAdvertiserProps) {
  const t = useTranslations("admin.showcase.form");
  return (
    <>
      <DeveloperSelect idPrefix="ad" developers={developers} value={developerId} onChange={onDeveloper} placeholder={t("developerNone")} />
      <Field
        id="ad-advertiser"
        name="advertiser"
        label={t("advertiser")}
        hint={t("advertiserHint")}
        maxLength={ADVERTISER_MAX}
        defaultValue={fields.advertiser}
        error={issue("advertiser")}
      />
    </>
  );
}

/** Название (подпись картинки) и кнопка под баннером: телефон Vodiy House или заявка. */
function AdTitleAndCta({ fields, issue }: { fields: AdFields; issue: Issue }) {
  const t = useTranslations("admin.showcase.form");
  return (
    <>
      <BilingualField
        id="ad-title"
        name="title"
        label={t("adTitle")}
        uzLabel={t("titleUz")}
        maxLength={SHOWCASE_LIMITS.titleMax}
        defaultValue={fields.title}
        required
        error={issue("title")}
      />
      <p className="field__meta">{t("adTitleHint")}</p>
      <ChoiceField
        id="ad-cta"
        name="cta"
        label={t("cta")}
        options={AD_CTAS.map((value) => ({ value, label: t(`ctas.${value}`) }))}
        defaultValue={fields.cta}
        error={issue("cta")}
      />
      <p className="field__meta">{t("ctaHint")}</p>
    </>
  );
}
