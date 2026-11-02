"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { ChoiceField } from "@/components/ChoiceField";
import type { MediaPreview } from "@/components/MediaDrop";
import { NEW_SHOWCASE_ID, showcaseListHref } from "@/lib/admin/nav";
import { SHOWCASE_LIMITS } from "@/lib/admin/showcase/forms";
import { specialFieldsOf, type SpecialErrors, type SpecialFields } from "@/lib/admin/showcase/specialForm";
import {
  SPECIAL_KINDS,
  type DeleteShowcaseResult,
  type FormAction,
  type SaveShowcaseResult,
  type ShowcaseMediaActions,
  type ShowcaseOptions,
  type SpecialRecord,
} from "@/lib/admin/showcase/types";
import { useShowcaseForm } from "@/lib/admin/showcase/useShowcaseForm";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { ComplexPicker } from "./ComplexPicker";
import { DeveloperSelect, OrderAndActive, PeriodFields, SaveRow, ShowcaseFooter } from "./ShowcaseParts";

export type SpecialFormProps = {
  /** null — новое спецпредложение. */
  record: SpecialRecord | null;
  options: ShowcaseOptions;
  action: FormAction<SaveShowcaseResult<SpecialFields, SpecialErrors>>;
  cover: MediaPreview | null;
  mediaActions: ShowcaseMediaActions | null;
  deleteAction: FormAction<DeleteShowcaseResult> | null;
  /** Корень раздела: /admin/vitrina или служебный стенд. */
  base: string;
};

type Issue = (field: keyof SpecialFields) => string | undefined;

/** Спецпредложение (3.16а): застройщик и вид, бейдж, заголовок, текст, ЖК застройщика, период, порядок. */
export function SpecialForm(props: SpecialFormProps) {
  const t = useTranslations("admin.showcase.form");
  const tIssue = useTranslations("admin.showcase.issues");
  const { state, formAction, pending, failed } = useShowcaseForm(props.action);
  const fields = failed?.fields ?? specialFieldsOf(props.record);
  const issue: Issue = (field) => {
    const code = failed?.fieldErrors[field];
    return code ? tIssue(code) : undefined;
  };
  const [developerId, setDeveloperId] = useState(fields.developerId);
  const { record } = props;
  return (
    <AdminPanel title={record ? t("editTitle.special") : t("newTitle.special")} wide>
      <form className="showcase-form" onSubmit={submitKeepingForm(formAction)} noValidate>
        <input type="hidden" name="id" value={record?.id ?? NEW_SHOWCASE_ID} />
        <SpecialHead fields={fields} issue={issue} options={props.options} developerId={developerId} onDeveloper={setDeveloperId} />
        <SpecialTexts fields={fields} issue={issue} />
        <ComplexPicker
          key={developerId}
          idPrefix="special"
          complexes={props.options.complexes}
          developerId={developerId}
          selected={fields.complexIds}
          label={t("complexes")}
          hint={t("complexesHint")}
          emptyText={developerId ? t("complexesNone") : t("complexesEmpty")}
          error={issue("complexIds")}
        />
        <PeriodFields idPrefix="special" validFrom={fields.validFrom} validTo={fields.validTo} issue={issue} />
        <OrderAndActive idPrefix="special" sort={fields.sort} isActive={fields.isActive} issue={issue} />
        <SaveRow state={state} pending={pending} isNew={!record} backHref={showcaseListHref("special", props.base)} />
      </form>
      <ShowcaseFooter
        kind="special"
        record={record ? { id: record.id, name: record.title.ru } : null}
        cover={props.cover}
        mediaActions={props.mediaActions}
        deleteAction={props.deleteAction}
      />
    </AdminPanel>
  );
}

type SpecialHeadProps = {
  fields: SpecialFields;
  issue: Issue;
  options: ShowcaseOptions;
  developerId: string;
  onDeveloper: (id: string) => void;
};

/** Застройщик и вид — в одном ряду. */
function SpecialHead({ fields, issue, options, developerId, onDeveloper }: SpecialHeadProps) {
  const t = useTranslations("admin.showcase.form");
  return (
    <div className="showcase-form__row showcase-form__row--two">
      <DeveloperSelect
        idPrefix="special"
        developers={options.developers}
        value={developerId}
        onChange={onDeveloper}
        error={issue("developerId")}
      />
      <ChoiceField
        id="special-kind"
        name="kind"
        label={t("kind")}
        options={SPECIAL_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
        defaultValue={fields.kind}
        error={issue("kind")}
      />
    </div>
  );
}

/** Бейдж для карточки ЖК, заголовок и текст — RU | UZ. */
function SpecialTexts({ fields, issue }: { fields: SpecialFields; issue: Issue }) {
  const t = useTranslations("admin.showcase.form");
  return (
    <>
      <BilingualField
        id="special-badge"
        name="badge"
        label={t("badge")}
        uzLabel={t("badgeUz")}
        maxLength={SHOWCASE_LIMITS.badgeMax}
        defaultValue={fields.badge}
        required
        error={issue("badge")}
      />
      <BilingualField
        id="special-title"
        name="title"
        label={t("title")}
        uzLabel={t("titleUz")}
        maxLength={SHOWCASE_LIMITS.titleMax}
        defaultValue={fields.title}
        required
        error={issue("title")}
      />
      <BilingualField
        id="special-text"
        name="text"
        label={t("text")}
        uzLabel={t("textUz")}
        multiline
        maxLength={SHOWCASE_LIMITS.textMax}
        defaultValue={fields.text}
        error={issue("text")}
      />
    </>
  );
}
