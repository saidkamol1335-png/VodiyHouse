"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { MediaDrop, type MediaPreview } from "@/components/MediaDrop";
import { Rule12Check } from "@/components/Rule12Check";
import { useOwnedMedia } from "@/lib/admin/media/useOwnedMedia";
import type { ShowcaseMediaActions } from "@/lib/admin/showcase/types";
import { BANNER_RATIOS, fitsBanner, type BannerKind, type ProcessedImage } from "@/lib/media";

type AdBannersProps = {
  /** id рекламы: файлы — в папке ads/<id>/. */
  id: string;
  initial: { banner: MediaPreview | null; bannerMobile: MediaPreview | null };
  /** null — без облака (служебный стенд): картинка остаётся в браузере. */
  actions: ShowcaseMediaActions | null;
};

/**
 * Картинки баннера (правки 15.11, п. 4 + 13): для ПК (3:1, обязательна для показа) и для телефона (4:5,
 * без неё — та же, что для ПК). Сохраняются сразу; отметка правила 1.2 — на каждую загрузку (на файле нет
 * контактов застройщика), без неё база откажет. Пропорцию проверяем до загрузки: сайт баннер не обрезает.
 */
export function AdBanners({ id, initial, actions }: AdBannersProps) {
  return (
    <div className="showcase-form__banners">
      <BannerDrop id={id} kind="banner" initial={initial.banner} actions={actions} />
      <BannerDrop id={id} kind="banner_mobile" initial={initial.bannerMobile} actions={actions} />
    </div>
  );
}

type BannerDropProps = { id: string; kind: BannerKind; initial: MediaPreview | null; actions: ShowcaseMediaActions | null };

function BannerDrop({ id, kind, initial, actions }: BannerDropProps) {
  const t = useTranslations("admin.showcase.form");
  const tErrors = useTranslations("admin.developers.errors");
  const [rule12, setRule12] = useState(false);
  const [ratioError, setRatioError] = useState<string | null>(null);
  const media = useOwnedMedia({ owner: { type: "ad", id }, kind, initial, actions, rule12, extraFields: { owner: "ad" } });
  const { label: ratio, example } = BANNER_RATIOS[kind];
  const uploaded = async (image: ProcessedImage) => {
    if (!fitsBanner(kind, image)) {
      setRatioError(t("bannerRatio", { ratio, example, width: image.width, height: image.height }));
      return;
    }
    setRatioError(null);
    if (await media.upload(image)) setRule12(false);
  };
  const desktop = kind === "banner";
  return (
    <div className="showcase-form__cover">
      <Rule12Check id={`ad-${kind}-rule12`} checked={rule12} onChange={setRule12} context="banner" />
      <MediaDrop
        id={`ad-${kind}`}
        kind={kind}
        variant="wide"
        label={t(desktop ? "banner" : "bannerMobile", { ratio })}
        disabled={Boolean(actions) && !rule12}
        value={media.preview}
        onPrepared={uploaded}
        onRemove={media.remove}
      />
      <p className="field__meta">{t(desktop ? "bannerHint" : "bannerMobileHint", { ratio, example })}</p>
      {ratioError ? <FormStatus tone="error">{ratioError}</FormStatus> : null}
      {media.error ? <FormStatus tone="error">{tErrors(media.error)}</FormStatus> : null}
    </div>
  );
}
