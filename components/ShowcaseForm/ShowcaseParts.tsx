"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import type { MediaPreview } from "@/components/MediaDrop";
import { SelectField } from "@/components/SelectField";
import { Switch } from "@/components/Switch";
import { SHOWCASE_LIMITS } from "@/lib/admin/showcase/forms";
import type {
  DeleteShowcaseResult,
  DeveloperOption,
  FormAction,
  SaveShowcaseResult,
  ShowcaseKind,
  ShowcaseMediaActions,
} from "@/lib/admin/showcase/types";
import { DeletePanel } from "./DeletePanel";
import { ShowcaseCover } from "./ShowcaseCover";

// Общие части форм витрины (3.16а): застройщик, период, порядок и тумблер «На сайте», строка
// сохранения, подвал панели с обложкой и удалением.

type DeveloperSelectProps = {
  idPrefix: string;
  developers: readonly DeveloperOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
};

/** Застройщик спецпредложения или рекламы — его ЖК появляются в отметках ниже. */
export function DeveloperSelect({ idPrefix, developers, value, onChange, error }: DeveloperSelectProps) {
  const t = useTranslations("admin.showcase.form");
  return (
    <SelectField
      id={`${idPrefix}-developer`}
      name="developerId"
      label={t("developer")}
      placeholder={t("developerPlaceholder")}
      options={developers.map((developer) => ({ value: developer.id, label: developer.name }))}
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      error={error}
    />
  );
}

type PeriodFieldsProps = {
  validFrom: string;
  validTo: string;
  issue: (field: "validFrom" | "validTo") => string | undefined;
  idPrefix: string;
};

export function PeriodFields({ validFrom, validTo, issue, idPrefix }: PeriodFieldsProps) {
  const t = useTranslations("admin.showcase.form");
  return (
    <div className="showcase-form__row showcase-form__row--two">
      <Field
        id={`${idPrefix}-from`}
        name="validFrom"
        label={t("validFrom")}
        hint={t("periodHint")}
        type="date"
        defaultValue={validFrom}
        error={issue("validFrom")}
      />
      <Field id={`${idPrefix}-to`} name="validTo" label={t("validTo")} type="date" defaultValue={validTo} error={issue("validTo")} />
    </div>
  );
}

type OrderAndActiveProps = {
  sort: string;
  isActive: boolean;
  issue: (field: "sort") => string | undefined;
  idPrefix: string;
};

export function OrderAndActive({ sort, isActive, issue, idPrefix }: OrderAndActiveProps) {
  const t = useTranslations("admin.showcase.form");
  return (
    <div className="showcase-form__row showcase-form__row--two">
      <Field
        id={`${idPrefix}-sort`}
        name="sort"
        label={t("sort")}
        hint={t("sortHint")}
        type="number"
        inputMode="numeric"
        min={0}
        max={SHOWCASE_LIMITS.sortMax}
        defaultValue={sort}
        error={issue("sort")}
      />
      <ActiveSwitch initial={isActive} />
    </div>
  );
}

/** Тумблер «На сайте»: значение уходит скрытым полем isActive = on | off. */
function ActiveSwitch({ initial }: { initial: boolean }) {
  const t = useTranslations("admin.showcase.form");
  const [checked, setChecked] = useState(initial);
  return (
    <div className="showcase-form__active">
      <input type="hidden" name="isActive" value={checked ? "on" : "off"} />
      <Switch
        checked={checked}
        label={checked ? t("active") : t("activeOff")}
        accessibleName={t("active")}
        onChange={setChecked}
      />
    </div>
  );
}

type SaveRowProps = {
  state: SaveShowcaseResult<unknown, unknown>;
  pending: boolean;
  isNew: boolean;
  backHref: string;
};

/** «← К списку», ответ сервера и «Сохранить» / «Создать» в одной строке. */
export function SaveRow({ state, pending, isNew, backHref }: SaveRowProps) {
  const t = useTranslations("admin.showcase.form");
  const tErrors = useTranslations("admin.developers.errors");
  return (
    <div className="showcase-form__save">
      <Link className="showcase-form__back" href={backHref}>
        {t("back")}
      </Link>
      {state.status === "saved" ? (
        <FormStatus key={state.at} tone="success">
          {t("saved")}
        </FormStatus>
      ) : null}
      {state.status === "error" ? <FormStatus tone="error">{tErrors(state.error ?? "invalid")}</FormStatus> : null}
      <Button type="submit" pending={pending} className="showcase-form__submit">
        {pending ? t("pending") : isNew ? t("create") : t("save")}
      </Button>
    </div>
  );
}

type ShowcaseFooterProps = {
  kind: ShowcaseKind;
  /** null — запись ещё не создана: обложка и удаление появятся после сохранения. */
  record: { id: string; name: string } | null;
  cover: MediaPreview | null;
  mediaActions: ShowcaseMediaActions | null;
  deleteAction: FormAction<DeleteShowcaseResult> | null;
};

/** Под формой: обложка (сохраняется сразу) и «Удалить» — только у сохранённой записи. */
export function ShowcaseFooter({ kind, record, cover, mediaActions, deleteAction }: ShowcaseFooterProps) {
  const t = useTranslations("admin.showcase.form");
  if (!record) return <p className="field__meta">{t("coverNew")}</p>;
  return (
    <>
      <ShowcaseCover kind={kind} id={record.id} initial={cover} actions={mediaActions} />
      {deleteAction ? <DeletePanel kind={kind} id={record.id} name={record.name} action={deleteAction} /> : null}
    </>
  );
}
