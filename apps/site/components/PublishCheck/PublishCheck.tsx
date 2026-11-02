"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import type { PublishPanelProps } from "@/components/StatusCapsule";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";

/** Файл для проверки: фото и фон — кадром, чертёж и логотип — целиком на белом. */
export type PublishFile = { id: string; src: string; kind: "photo" | "drawing" | "facade" | "floor_plan" | "logo" | "cover" };

/** Тексты панели: у ЖК и застройщика одинаковые ключи. */
export type PublishCheckMessages = "admin.complexes.publish" | "admin.developers.publish";

type PublishCheckProps = PublishPanelProps & {
  entityId: string;
  files: readonly PublishFile[];
  messages: PublishCheckMessages;
};

/**
 * «Опубликовать?» (И8): как «Проверить» у видеографа в мокапе — все файлы, что уйдут на сайт,
 * галочка правила 1.2, и только тогда «Опубликовать». Отметку сервер ставит в том же действии.
 */
export function PublishCheck(props: PublishCheckProps) {
  const { entityId, files, messages, formAction, pending, onCancel } = props;
  const t = useTranslations(messages as "admin.complexes.publish");
  const [checked, setChecked] = useState(false);
  return (
    // Без автосброса React 19: после отказа («не хватает фото») галочка остаётся видимой.
    <form className="publish-check" onSubmit={submitKeepingForm(formAction)}>
      <input type="hidden" name="id" value={entityId} />
      <input type="hidden" name="to" value="published" />
      <p className="publish-check__title">{t("title")}</p>
      <p className="publish-check__lead">{t("lead")}</p>
      {files.length > 0 ? (
        <ul className="publish-check__files" aria-label={t("filesLabel", { count: files.length })}>
          {files.map((file) => (
            <li key={file.id} className={`publish-check__file publish-check__file--${file.kind}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- превью из бакета в кабинете; next/image — на сайте (фаза 3) */}
              <img src={file.src} alt="" loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="publish-check__lead">{t("noFiles")}</p>
      )}
      <label className="publish-check__check">
        <input
          type="checkbox"
          name="rule12"
          value="on"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>{t("check")}</span>
      </label>
      <div className="publish-check__actions">
        <Button type="submit" size="sm" disabled={!checked} pending={pending}>
          {pending ? t("pending") : t("submit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
