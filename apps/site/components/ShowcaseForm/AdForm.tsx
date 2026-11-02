"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { ChoiceField } from "@/components/ChoiceField";
import type { MediaPreview } from "@/components/MediaDrop";
import { NEW_SHOWCASE_ID, showcaseListHref } from "@/lib/admin/nav";
import { AD_TARGETS, adFieldsOf, type AdErrors, type AdFields } from "@/lib/admin/showcase/adForm";
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
import { ComplexPicker } from "./ComplexPicker";
import { FilterFields } from "./FilterFields";
import { DeveloperSelect, OrderAndActive, PeriodFields, SaveRow, ShowcaseFooter } from "./ShowcaseParts";

export type AdFormProps = {
  record: AdRecord | null;
  options: ShowcaseOptions;
  action: FormAction<SaveShowcaseResult<AdFields, AdErrors>>;
  cover: MediaPreview | null;
  mediaActions: ShowcaseMediaActions | null;
  deleteAction: FormAction<DeleteShowcaseResult> | null;
  base: string;
};

type Issue = (field: keyof AdFields) => string | undefined;

/** Реклама (3.16а, Г1 A): застройщик, тексты, цель — ЖК или фильтр, период, порядок очереди. */
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
        <DeveloperSelect
          idPrefix="ad"
          developers={props.options.developers}
          value={developerId}
          onChange={setDeveloperId}
          error={issue("developerId")}
        />
        <AdTexts fields={fields} issue={issue} />
        <AdTarget developerId={developerId} fields={fields} options={props.options} issue={issue} />
        <PeriodFields idPrefix="ad" validFrom={fields.validFrom} validTo={fields.validTo} issue={issue} />
        <OrderAndActive idPrefix="ad" sort={fields.sort} isActive={fields.isActive} issue={issue} />
        <SaveRow state={state} pending={pending} isNew={!record} backHref={showcaseListHref("ad", props.base)} />
      </form>
      <ShowcaseFooter
        kind="ad"
        record={record ? { id: record.id, name: record.title.ru } : null}
        cover={props.cover}
        mediaActions={props.mediaActions}
        deleteAction={props.deleteAction}
      />
    </AdminPanel>
  );
}

function AdTexts({ fields, issue }: { fields: AdFields; issue: Issue }) {
  const t = useTranslations("admin.showcase.form");
  return (
    <>
      <BilingualField
        id="ad-title"
        name="title"
        label={t("title")}
        uzLabel={t("titleUz")}
        maxLength={SHOWCASE_LIMITS.titleMax}
        defaultValue={fields.title}
        required
        error={issue("title")}
      />
      <BilingualField
        id="ad-text"
        name="text"
        label={t("text")}
        uzLabel={t("textUz")}
        multiline
        maxLength={SHOWCASE_LIMITS.adTextMax}
        defaultValue={fields.text}
        error={issue("text")}
      />
    </>
  );
}

type AdTargetProps = {
  developerId: string;
  fields: AdFields;
  options: ShowcaseOptions;
  issue: Issue;
};

/** Куда ведёт «Показать N квартир»: ЖК застройщика или каталог с фильтром. */
function AdTarget({ developerId, fields, options, issue }: AdTargetProps) {
  const t = useTranslations("admin.showcase.form");
  const [target, setTarget] = useState(fields.target);
  return (
    <>
      <ChoiceField
        id="ad-target"
        name="target"
        label={t("target")}
        options={AD_TARGETS.map((value) => ({ value, label: t(`targets.${value}`) }))}
        value={target}
        onChange={setTarget}
        error={issue("target")}
      />
      {target === "filter" ? (
        <FilterFields idPrefix="ad" filter={fields.filter} locations={options.locations} error={issue("filter")} />
      ) : (
        <ComplexPicker
          key={developerId}
          idPrefix="ad"
          complexes={options.complexes}
          developerId={developerId}
          selected={fields.complexIds}
          label={t("complexes")}
          hint={t("complexesHint")}
          emptyText={developerId ? t("complexesNone") : t("complexesEmpty")}
          error={issue("complexIds")}
        />
      )}
    </>
  );
}
