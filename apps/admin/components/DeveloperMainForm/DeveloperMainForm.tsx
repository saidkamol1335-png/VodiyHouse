"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { EMPTY_BILINGUAL } from "@/lib/admin/bilingual";
import { DEVELOPER_LIMITS, type DeveloperMainFields } from "@/lib/admin/developers/mainForm";
import type {
  DeveloperMediaActions,
  DeveloperRecord,
  FormAction,
  SaveMainResult,
} from "@/lib/admin/developers/types";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { ROUTES } from "@/lib/routes";
import { DeveloperMediaFields, type DeveloperMediaPreviews } from "./DeveloperMediaFields";

type DeveloperMainFormProps = {
  developer: DeveloperRecord;
  action: FormAction<SaveMainResult>;
  media: DeveloperMediaPreviews;
  /** null — без облака (служебный стенд): фото остаются в браузере. */
  mediaActions: DeveloperMediaActions | null;
  /** Список ЖК с фильтром по застройщику (?zastroyshchik=…). */
  complexesHref: string;
};

type FieldsProps = {
  fields: DeveloperMainFields;
  issue: (field: keyof DeveloperMainFields) => string | undefined;
};

const IDLE: SaveMainResult = { status: "idle" };

function fieldsOf(developer: DeveloperRecord): DeveloperMainFields {
  return {
    name: developer.name,
    foundedYear: developer.foundedYear?.toString() ?? "",
    flatsDelivered: developer.flatsDelivered?.toString() ?? "",
    deliveredCheckedAt: developer.deliveredCheckedAt ?? "",
    about: developer.about ?? EMPTY_BILINGUAL,
    founders: developer.founders ?? EMPTY_BILINGUAL,
  };
}

/** Вкладка «Основное» (Д2–Д4): название и факты, тексты RU | UZ, логотип и фон; сохранение по вкладке. */
export function DeveloperMainForm(props: DeveloperMainFormProps) {
  const { developer } = props;
  const t = useTranslations("admin.developers");
  const [state, formAction, pending] = useActionState(
    (_previous: SaveMainResult, formData: FormData) => props.action(formData),
    IDLE,
  );
  const failed = state.status === "error" ? state : null;
  const fields = failed?.fields ?? fieldsOf(developer);
  const issue = (field: keyof DeveloperMainFields) => {
    const code = failed?.fieldErrors[field];
    return code ? t(`issues.${code}`, { min: DEVELOPER_LIMITS.nameMin }) : undefined;
  };
  return (
    <AdminPanel title={t("fields.title")} wide>
      {/* Без автосброса React 19: управляемая отметка 1.2 логотипа и фона внутри формы. */}
      <form className="developer-main" onSubmit={submitKeepingForm(formAction)} noValidate>
        <input type="hidden" name="id" value={developer.id} />
        <div className="developer-main__facts">
          <IdentityFacts fields={fields} issue={issue} />
          <DeliveryFacts fields={fields} issue={issue} />
        </div>
        <DeveloperTexts
          fields={fields}
          issue={issue}
          slug={developer.slug}
          complexesHref={props.complexesHref}
        />
        <DeveloperMediaFields
          developerId={developer.id}
          published={developer.status === "published"}
          media={props.media}
          actions={props.mediaActions}
        />
        <div className="developer-main__save">
          <SaveFeedback state={state} />
          <Button type="submit" pending={pending} className="developer-main__submit">
            {pending ? t("pending") : t("fields.save")}
          </Button>
        </div>
      </form>
    </AdminPanel>
  );
}

function IdentityFacts({ fields, issue }: FieldsProps) {
  const t = useTranslations("admin.developers.fields");
  return (
    <>
      <Field
        className="field--subgrid"
        id="developer-name"
        name="name"
        label={t("name")}
        defaultValue={fields.name}
        maxLength={DEVELOPER_LIMITS.nameMax}
        error={issue("name")}
      />
      <Field
        className="field--subgrid"
        id="developer-founded"
        name="foundedYear"
        label={t("foundedYear")}
        type="number"
        inputMode="numeric"
        defaultValue={fields.foundedYear}
        min={DEVELOPER_LIMITS.yearMin}
        max={DEVELOPER_LIMITS.yearMax}
        error={issue("foundedYear")}
      />
    </>
  );
}

function DeliveryFacts({ fields, issue }: FieldsProps) {
  const t = useTranslations("admin.developers.fields");
  return (
    <>
      <Field
        className="field--subgrid"
        id="developer-flats"
        name="flatsDelivered"
        label={t("flatsDelivered")}
        type="number"
        inputMode="numeric"
        defaultValue={fields.flatsDelivered}
        min={0}
        error={issue("flatsDelivered")}
      />
      <Field
        className="field--subgrid"
        id="developer-checked"
        name="deliveredCheckedAt"
        label={t("deliveredCheckedAt")}
        hint={t("deliveredCheckedAtHint")}
        type="date"
        defaultValue={fields.deliveredCheckedAt}
        error={issue("deliveredCheckedAt")}
      />
    </>
  );
}

type TextsProps = FieldsProps & { slug: string; complexesHref: string };

/** Адрес на сайте со ссылкой на ЖК застройщика и тексты RU | UZ. */
function DeveloperTexts({ fields, issue, slug, complexesHref }: TextsProps) {
  const t = useTranslations("admin.developers");
  return (
    <>
      <p className="developer-main__slug">
        {t("slug")}: {ROUTES.developers}/{slug}
        <Link className="developer-main__complexes" href={complexesHref}>
          {t("complexesLink")}
        </Link>
      </p>
      <BilingualField
        id="developer-about"
        name="about"
        label={t("fields.about")}
        uzLabel={t("fields.aboutUz")}
        multiline
        maxLength={DEVELOPER_LIMITS.aboutMax}
        defaultValue={fields.about}
        error={issue("about")}
      />
      <BilingualField
        id="developer-founders"
        name="founders"
        label={t("fields.founders")}
        uzLabel={t("fields.foundersUz")}
        maxLength={DEVELOPER_LIMITS.foundersMax}
        defaultValue={fields.founders}
        error={issue("founders")}
      />
    </>
  );
}

/** «Сохранено» или отказ сервера рядом с кнопкой; ошибки полей — под полями. */
function SaveFeedback({ state }: { state: SaveMainResult }) {
  const t = useTranslations("admin.developers");
  if (state.status === "saved") {
    return (
      <FormStatus key={state.at} tone="success">
        {t("saved")}
      </FormStatus>
    );
  }
  if (state.status !== "error") return null;
  // Ошибки полей видны под полями (у RU | UZ — под парой) — здесь общий итог.
  return <FormStatus tone="error">{t(`errors.${state.error ?? "invalid"}`)}</FormStatus>;
}
