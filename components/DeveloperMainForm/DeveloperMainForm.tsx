"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { MediaDrop, type MediaPreview } from "@/components/MediaDrop";
import { Rule12Check } from "@/components/Rule12Check";
import { EMPTY_BILINGUAL } from "@/lib/admin/bilingual";
import { DEVELOPER_LIMITS, type DeveloperMainFields } from "@/lib/admin/developers/mainForm";
import type {
  DeveloperMediaActions,
  DeveloperRecord,
  FormAction,
  SaveMainResult,
} from "@/lib/admin/developers/types";
import { useDeveloperMedia } from "@/lib/admin/developers/useDeveloperMedia";
import type { ProcessedImage } from "@/lib/media";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { ROUTES } from "@/lib/routes";

type DeveloperMainFormProps = {
  developer: DeveloperRecord;
  action: FormAction<SaveMainResult>;
  media: { logo: MediaPreview | null; cover: MediaPreview | null };
  /** null — без облака (служебный стенд): фото остаются в браузере. */
  mediaActions: DeveloperMediaActions | null;
  /** Список ЖК с фильтром по застройщику (?zastroyshchik=…). */
  complexesHref: string;
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
export function DeveloperMainForm({
  developer,
  action,
  media,
  mediaActions,
  complexesHref,
}: DeveloperMainFormProps) {
  const t = useTranslations("admin.developers");
  const [state, formAction, pending] = useActionState(
    (_previous: SaveMainResult, formData: FormData) => action(formData),
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
          <Field
            className="field--subgrid"
            id="developer-name"
            name="name"
            label={t("fields.name")}
            defaultValue={fields.name}
            maxLength={DEVELOPER_LIMITS.nameMax}
            error={issue("name")}
          />
          <Field
            className="field--subgrid"
            id="developer-founded"
            name="foundedYear"
            label={t("fields.foundedYear")}
            type="number"
            inputMode="numeric"
            defaultValue={fields.foundedYear}
            min={DEVELOPER_LIMITS.yearMin}
            max={DEVELOPER_LIMITS.yearMax}
            error={issue("foundedYear")}
          />
          <Field
            className="field--subgrid"
            id="developer-flats"
            name="flatsDelivered"
            label={t("fields.flatsDelivered")}
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
            label={t("fields.deliveredCheckedAt")}
            hint={t("fields.deliveredCheckedAtHint")}
            type="date"
            defaultValue={fields.deliveredCheckedAt}
            error={issue("deliveredCheckedAt")}
          />
        </div>
        <p className="developer-main__slug">
          {t("slug")}: {ROUTES.developers}/{developer.slug}
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
        <DeveloperMediaFields
          developerId={developer.id}
          published={developer.status === "published"}
          media={media}
          actions={mediaActions}
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

type MediaFieldsProps = {
  developerId: string;
  /** Опубликован — файл сразу на сайте: загрузка с отметкой правила 1.2 (И8). */
  published: boolean;
  media: DeveloperMainFormProps["media"];
  actions: DeveloperMediaActions | null;
};

/** Логотип — плитка «+», фон — широкая зона с точкой фокуса (Д4). Сохраняются сразу, без кнопки. */
function DeveloperMediaFields({ developerId, published, media, actions }: MediaFieldsProps) {
  const t = useTranslations("admin.developers");
  const [rule12, setRule12] = useState(false);
  const locked = published && !rule12;
  const params = { developerId, actions, rule12 };
  const logo = useDeveloperMedia({ ...params, kind: "logo", initial: media.logo });
  const cover = useDeveloperMedia({ ...params, kind: "cover", initial: media.cover });
  const error = logo.error ?? cover.error;
  // Отметка 1.2 — на одну загрузку (И8): после удачной снимается, после отказа остаётся.
  const uploaded = (upload: typeof logo.upload) => async (image: ProcessedImage) => {
    if (await upload(image)) setRule12(false);
  };
  return (
    <>
      {published ? (
        <Rule12Check
          id="developer-rule12"
          checked={rule12}
          onChange={setRule12}
          context="developer"
        />
      ) : (
        <p className="field__meta">{t("media.rule12Hint")}</p>
      )}
      <div className="developer-main__media">
        <MediaDrop
          id="developer-logo"
          kind="logo"
          variant="tile"
          label={t("fields.logo")}
          disabled={locked}
          value={logo.preview}
          onPrepared={uploaded(logo.upload)}
          onRemove={logo.remove}
        />
        <MediaDrop
          id="developer-cover"
          kind="cover"
          variant="wide"
          label={t("fields.cover")}
          disabled={locked}
          value={cover.preview}
          onPrepared={uploaded(cover.upload)}
          onRemove={cover.remove}
          onFocusChange={cover.setFocus}
        />
      </div>
      {error ? (
        <FormStatus tone="error">
          {error === "notReady" ? t("media.logoPublished") : t(`errors.${error}`)}
        </FormStatus>
      ) : null}
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
