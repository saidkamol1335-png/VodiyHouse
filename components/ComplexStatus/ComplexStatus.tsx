"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ComplexReadiness } from "@/components/ComplexReadiness";
import { FormStatus } from "@/components/FormStatus";
import { PublishCheck } from "@/components/PublishCheck";
import { StatusCapsule } from "@/components/StatusCapsule";
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
export function ComplexStatus({ complex, action, readiness, files, base, developer }: ComplexStatusProps) {
  const t = useTranslations("admin.complexes");
  const showReadiness = complex.status === "draft" || complex.status === "hidden";
  return (
    <StatusCapsule
      entity={complex}
      name={complex.name}
      action={action}
      messages="admin.complexes.status"
      publishPanel={(panel) => <PublishCheck {...panel} entityId={complex.id} files={files} messages="admin.complexes.publish" />}
    >
      {showReadiness ? <ComplexReadiness items={readiness} base={base} /> : null}
      {developer.published || complex.status === "archived" ? null : (
        <FormStatus tone="notice">
          {t("developerHidden", { name: developer.name })} <Link href={developer.href}>{t("toDeveloper")}</Link>
        </FormStatus>
      )}
    </StatusCapsule>
  );
}
