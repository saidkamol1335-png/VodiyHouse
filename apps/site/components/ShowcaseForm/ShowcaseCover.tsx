"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { MediaDrop, type MediaPreview } from "@/components/MediaDrop";
import { Rule12Check } from "@/components/Rule12Check";
import { useOwnedMedia } from "@/lib/admin/media/useOwnedMedia";
import type { ShowcaseKind, ShowcaseMediaActions } from "@/lib/admin/showcase/types";
import type { ProcessedImage } from "@/lib/media";

type ShowcaseCoverProps = {
  kind: ShowcaseKind;
  id: string;
  initial: MediaPreview | null;
  /** null — без облака (служебный стенд): фото остаётся в браузере. */
  actions: ShowcaseMediaActions | null;
};

/**
 * Обложка записи витрины: широкая зона с точкой фокуса, сохраняется сразу. Обложка уходит на сайт,
 * как только запись включена, поэтому отметка правила 1.2 — на каждую загрузку (база без неё откажет).
 */
export function ShowcaseCover({ kind, id, initial, actions }: ShowcaseCoverProps) {
  const t = useTranslations("admin.showcase.form");
  const tErrors = useTranslations("admin.developers.errors");
  const [rule12, setRule12] = useState(false);
  const media = useOwnedMedia({
    owner: { type: kind, id },
    kind: "cover",
    initial,
    actions,
    rule12,
    extraFields: { owner: kind },
  });
  const uploaded = async (image: ProcessedImage) => {
    if (await media.upload(image)) setRule12(false);
  };
  return (
    <div className="showcase-form__cover">
      <Rule12Check id={`${kind}-rule12`} checked={rule12} onChange={setRule12} context="showcase" />
      <MediaDrop
        id={`${kind}-cover`}
        kind="cover"
        variant="wide"
        label={t("cover")}
        disabled={Boolean(actions) && !rule12}
        value={media.preview}
        onPrepared={uploaded}
        onRemove={media.remove}
        onFocusChange={media.setFocus}
      />
      <p className="field__meta">{t("coverHint")}</p>
      {media.error ? <FormStatus tone="error">{tErrors(media.error)}</FormStatus> : null}
    </div>
  );
}
