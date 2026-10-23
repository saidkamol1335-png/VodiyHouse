"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { MediaDrop, type MediaPreview } from "@/components/MediaDrop";
import { Rule12Check } from "@/components/Rule12Check";
import type { DeveloperMediaActions } from "@/lib/admin/developers/types";
import { useDeveloperMedia } from "@/lib/admin/developers/useDeveloperMedia";
import type { ProcessedImage } from "@/lib/media";

export type DeveloperMediaPreviews = { logo: MediaPreview | null; cover: MediaPreview | null };

type MediaFieldsProps = {
  developerId: string;
  /** Опубликован — файл сразу на сайте: загрузка с отметкой правила 1.2 (И8). */
  published: boolean;
  media: DeveloperMediaPreviews;
  actions: DeveloperMediaActions | null;
};

type DeveloperMedia = ReturnType<typeof useDeveloperMedia>;

/** Логотип — плитка «+», фон — широкая зона с точкой фокуса (Д4). Сохраняются сразу, без кнопки. */
export function DeveloperMediaFields({ developerId, published, media, actions }: MediaFieldsProps) {
  const t = useTranslations("admin.developers");
  const [rule12, setRule12] = useState(false);
  const params = { developerId, actions, rule12 };
  const logo = useDeveloperMedia({ ...params, kind: "logo", initial: media.logo });
  const cover = useDeveloperMedia({ ...params, kind: "cover", initial: media.cover });
  // Отметка 1.2 — на одну загрузку (И8): после удачной снимается, после отказа остаётся.
  const uploaded = (upload: DeveloperMedia["upload"]) => async (image: ProcessedImage) => {
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
      <MediaDrops
        locked={published && !rule12}
        logo={logo}
        cover={cover}
        onLogo={uploaded(logo.upload)}
        onCover={uploaded(cover.upload)}
      />
      <MediaError error={logo.error ?? cover.error} />
    </>
  );
}

type MediaDropsProps = {
  locked: boolean;
  logo: DeveloperMedia;
  cover: DeveloperMedia;
  onLogo: (image: ProcessedImage) => Promise<void>;
  onCover: (image: ProcessedImage) => Promise<void>;
};

function MediaDrops({ locked, logo, cover, onLogo, onCover }: MediaDropsProps) {
  const t = useTranslations("admin.developers.fields");
  return (
    <div className="developer-main__media">
      <MediaDrop
        id="developer-logo"
        kind="logo"
        variant="tile"
        label={t("logo")}
        disabled={locked}
        value={logo.preview}
        onPrepared={onLogo}
        onRemove={logo.remove}
      />
      <MediaDrop
        id="developer-cover"
        kind="cover"
        variant="wide"
        label={t("cover")}
        disabled={locked}
        value={cover.preview}
        onPrepared={onCover}
        onRemove={cover.remove}
        onFocusChange={cover.setFocus}
      />
    </div>
  );
}

/** Отказ загрузки, удаления или базы — строкой под фото. */
function MediaError({ error }: { error: DeveloperMedia["error"] }) {
  const t = useTranslations("admin.developers");
  if (!error) return null;
  return (
    <FormStatus tone="error">
      {error === "notReady" ? t("media.logoPublished") : t(`errors.${error}`)}
    </FormStatus>
  );
}
