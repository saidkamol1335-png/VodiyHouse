"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { ComplexReadiness } from "@/components/ComplexReadiness";
import { FormStatus } from "@/components/FormStatus";
import { StatusCapsule, type PublishPanelProps } from "@/components/StatusCapsule";
import type { ReadinessItem } from "@/lib/admin/complexes/readiness";
import type { ComplexFilePreview, ComplexStatusResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import type { PublicationStatus } from "@/lib/admin/publication";

type ComplexStatusProps = {
  complex: { id: string; name: string; status: PublicationStatus; archivedAt: string | null };
  action: FormAction<ComplexStatusResult>;
  readiness: readonly ReadinessItem[];
  files: readonly ComplexFilePreview[];
  /** Адрес страницы ЖК: пункты готовности ведут на вкладки. */
  base: string;
  /** Застройщик не опубликован — сайт ЖК не покажет (is_public_complex): ссылка на него. */
  developer: { name: string; published: boolean; href: string };
};

/** Статус ЖК в шапке: капсула 10.2, готовность (И9) и публикация с проверкой правила 1.2 (И8). */
export function ComplexStatus({
  complex,
  action,
  readiness,
  files,
  base,
  developer,
}: ComplexStatusProps) {
  const t = useTranslations("admin.complexes");
  const showReadiness = complex.status === "draft" || complex.status === "hidden";
  return (
    <StatusCapsule
      entity={complex}
      name={complex.name}
      action={action}
      messages="admin.complexes.status"
      publishPanel={(panel) => <PublishPanel {...panel} complexId={complex.id} files={files} />}
    >
      {showReadiness ? <ComplexReadiness items={readiness} base={base} /> : null}
      {developer.published || complex.status === "archived" ? null : (
        <FormStatus tone="notice">
          {t("developerHidden", { name: developer.name })}{" "}
          <Link href={developer.href}>{t("toDeveloper")}</Link>
        </FormStatus>
      )}
    </StatusCapsule>
  );
}

type PublishPanelOwnProps = PublishPanelProps & {
  complexId: string;
  files: readonly ComplexFilePreview[];
};

/** Как «Проверить» у видеографа в мокапе: все фото и чертежи, галочка — и только тогда «Опубликовать». */
function PublishPanel({ complexId, files, formAction, pending, onCancel }: PublishPanelOwnProps) {
  const t = useTranslations("admin.complexes.publish");
  const [checked, setChecked] = useState(false);
  return (
    <form className="complex-publish" action={formAction}>
      <input type="hidden" name="id" value={complexId} />
      <input type="hidden" name="to" value="published" />
      <p className="complex-publish__title">{t("title")}</p>
      <p className="complex-publish__lead">{t("lead")}</p>
      {files.length > 0 ? (
        <ul
          className="complex-publish__files"
          aria-label={t("filesLabel", { count: files.length })}
        >
          {files.map((file) => (
            <li
              key={file.id}
              className={`complex-publish__file complex-publish__file--${file.kind}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- превью из бакета в кабинете; next/image — на сайте (фаза 3) */}
              <img src={file.src} alt="" loading="lazy" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="complex-publish__lead">{t("noFiles")}</p>
      )}
      <label className="complex-publish__check">
        <input
          type="checkbox"
          name="rule12"
          value="on"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>{t("check")}</span>
      </label>
      <div className="complex-publish__actions">
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
