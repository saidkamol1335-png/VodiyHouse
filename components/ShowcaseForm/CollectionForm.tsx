"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { ChoiceField } from "@/components/ChoiceField";
import type { MediaPreview } from "@/components/MediaDrop";
import { NEW_SHOWCASE_ID, showcaseListHref } from "@/lib/admin/nav";
import {
  collectionFieldsOf,
  type CollectionErrors,
  type CollectionFields,
} from "@/lib/admin/showcase/collectionForm";
import { SHOWCASE_LIMITS } from "@/lib/admin/showcase/forms";
import {
  COLLECTION_MODES,
  type CollectionRecord,
  type DeleteShowcaseResult,
  type FormAction,
  type SaveShowcaseResult,
  type ShowcaseMediaActions,
  type ShowcaseOptions,
} from "@/lib/admin/showcase/types";
import { useShowcaseForm } from "@/lib/admin/showcase/useShowcaseForm";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { ComplexPicker } from "./ComplexPicker";
import { FilterFields } from "./FilterFields";
import { OrderAndActive, SaveRow, ShowcaseFooter } from "./ShowcaseParts";

export type CollectionFormProps = {
  record: CollectionRecord | null;
  options: ShowcaseOptions;
  action: FormAction<SaveShowcaseResult<CollectionFields, CollectionErrors>>;
  cover: MediaPreview | null;
  mediaActions: ShowcaseMediaActions | null;
  deleteAction: FormAction<DeleteShowcaseResult> | null;
  base: string;
  /** Адрес каталога на сайте — для строки «Адрес на сайте: /novostroyki?podborka=…». */
  catalogHref: string;
};

type Issue = (field: keyof CollectionFields) => string | undefined;

/** Подборка (3.16а, мокап coll*): название, ЖК вручную или фильтр, порядок на главной. */
export function CollectionForm(props: CollectionFormProps) {
  const t = useTranslations("admin.showcase.form");
  const tIssue = useTranslations("admin.showcase.issues");
  const { state, formAction, pending, failed } = useShowcaseForm(props.action);
  const fields = failed?.fields ?? collectionFieldsOf(props.record);
  const issue: Issue = (field) => {
    const code = failed?.fieldErrors[field];
    return code ? tIssue(code) : undefined;
  };
  const { record } = props;
  const address = record ? `${props.catalogHref}?podborka=${record.slug}` : t("slugNew");
  return (
    <AdminPanel title={record ? t("editTitle.collection") : t("newTitle.collection")} wide>
      <form className="showcase-form" onSubmit={submitKeepingForm(formAction)} noValidate>
        <input type="hidden" name="id" value={record?.id ?? NEW_SHOWCASE_ID} />
        <BilingualField
          id="collection-title"
          name="title"
          label={t("collectionTitle")}
          uzLabel={t("collectionTitleUz")}
          maxLength={SHOWCASE_LIMITS.collectionTitleMax}
          defaultValue={fields.title}
          required
          error={issue("title")}
        />
        <p className="showcase-form__slug">
          {t("slug")}: {address}
        </p>
        <CollectionSource fields={fields} options={props.options} issue={issue} />
        <OrderAndActive idPrefix="collection" sort={fields.sort} isActive={fields.isActive} issue={issue} />
        <SaveRow state={state} pending={pending} isNew={!record} backHref={showcaseListHref("collection", props.base)} />
      </form>
      <ShowcaseFooter
        kind="collection"
        record={record ? { id: record.id, name: record.title.ru } : null}
        cover={props.cover}
        mediaActions={props.mediaActions}
        deleteAction={props.deleteAction}
      />
    </AdminPanel>
  );
}

type CollectionSourceProps = { fields: CollectionFields; options: ShowcaseOptions; issue: Issue };

/** Как собирается подборка: ЖК вручную (общий список с застройщиками) или условия фильтра. */
function CollectionSource({ fields, options, issue }: CollectionSourceProps) {
  const t = useTranslations("admin.showcase.form");
  const [mode, setMode] = useState(fields.mode);
  return (
    <>
      <ChoiceField
        id="collection-mode"
        name="mode"
        label={t("mode")}
        options={COLLECTION_MODES.map((value) => ({ value, label: t(`modes.${value}`) }))}
        value={mode}
        onChange={setMode}
        error={issue("mode")}
      />
      {mode === "manual" ? (
        <ComplexPicker
          idPrefix="collection"
          complexes={options.complexes}
          developers={options.developers}
          selected={fields.complexIds}
          label={t("complexes")}
          hint={t("complexesAll")}
          emptyText={t("complexesNone")}
          error={issue("complexIds")}
        />
      ) : (
        <FilterFields idPrefix="collection" filter={fields.filter} locations={options.locations} error={issue("filter")} />
      )}
    </>
  );
}
