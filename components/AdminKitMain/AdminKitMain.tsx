"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { MediaDrop, type MediaPreview } from "@/components/MediaDrop";
import { DEFAULT_FOCUS, type FocusPoint, type ProcessedImage } from "@/lib/media";

// DEMO: застройщик и текст «О компании» из мокапа (как в supabase/demo/seed.sql).
const DEMO_ABOUT = {
  ru: "Строит жильё в Фергане и Маргилане с 2012 года. Основатели — инженеры-строители, начинали с ремонта и реконструкции. Ключевые проекты — Mehr в Маргилане и Shodlik у центрального парка Ферганы.",
  uz: "2012 yildan beri Farg‘ona va Marg‘ilonda uy-joy quradi. Asoschilari — quruvchi muhandislar, faoliyatni ta’mirlash va rekonstruksiyadan boshlagan. Asosiy loyihalari — Marg‘ilondagi Mehr va Farg‘ona markaziy bog‘i yonidagi Shodlik.",
};

/** Превью без бакета: файл остаётся в браузере (облачная загрузка — шаг 9.4). */
function useLocalPreview() {
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const replace = (next: MediaPreview | null) =>
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous.src);
      return next;
    });
  const fromImage = async (image: ProcessedImage) => {
    const src = URL.createObjectURL(image.blob);
    replace({ src, width: image.width, height: image.height, focus: DEFAULT_FOCUS });
  };
  const setFocus = (focus: FocusPoint) => setPreview((current) => current && { ...current, focus });
  return { preview, fromImage, clear: () => replace(null), setFocus };
}

/** /dev/admin-kit: вкладка «Основное» застройщика на компонентах шага 10. Только разработка. */
export function AdminKitMain() {
  const t = useTranslations("admin.developers.fields");
  const logo = useLocalPreview();
  const cover = useLocalPreview();
  return (
    <AdminPanel title={t("title")} wide>
      <div className="admin-kit-main">
        <div className="admin-kit-main__facts">
          <Field
            id="developer-name"
            label={t("name")}
            defaultValue="Farg‘ona Sifat Qurilish"
            maxLength={60}
          />
          <Field
            id="developer-founded"
            label={t("foundedYear")}
            type="number"
            defaultValue="2012"
          />
          <Field
            id="developer-flats"
            label={t("flatsDelivered")}
            type="number"
            defaultValue="2140"
          />
          <Field
            id="developer-checked"
            label={t("deliveredCheckedAt")}
            hint={t("deliveredCheckedAtHint")}
            type="date"
            defaultValue="2026-09-14"
          />
        </div>
        <BilingualField
          id="developer-about"
          name="about"
          label={t("about")}
          uzLabel={t("aboutUz")}
          multiline
          maxLength={600}
          defaultValue={DEMO_ABOUT}
        />
        <BilingualField
          id="developer-founders"
          name="founders"
          label={t("founders")}
          uzLabel={t("foundersUz")}
          maxLength={200}
        />
        <div className="admin-kit-main__media">
          <MediaDrop
            id="developer-logo"
            kind="logo"
            variant="tile"
            label={t("logo")}
            value={logo.preview}
            onPrepared={logo.fromImage}
            onRemove={logo.clear}
          />
          <MediaDrop
            id="developer-cover"
            kind="cover"
            variant="wide"
            label={t("cover")}
            value={cover.preview}
            onPrepared={cover.fromImage}
            onRemove={cover.clear}
            onFocusChange={cover.setFocus}
          />
        </div>
        <div className="admin-kit-main__save">
          <Button>{t("save")}</Button>
        </div>
      </div>
    </AdminPanel>
  );
}
