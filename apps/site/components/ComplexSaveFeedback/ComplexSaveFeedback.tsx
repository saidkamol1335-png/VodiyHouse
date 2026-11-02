"use client";

import { useTranslations } from "next-intl";
import { FormStatus } from "@/components/FormStatus";
import type { ComplexRequirement } from "@/lib/admin/complexes/readiness";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";

type SaveState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; error: ContentErrorCode | null; broken: readonly ComplexRequirement[] };

/** Рядом с «Сохранить вкладку» у ЖК: «Сохранено», отказ сервера или чего лишился бы опубликованный ЖК. */
export function ComplexSaveFeedback({ state }: { state: SaveState }) {
  const t = useTranslations("admin");
  if (state.status === "saved") {
    return (
      <FormStatus key={state.at} tone="success">
        {t("complexes.saved")}
      </FormStatus>
    );
  }
  if (state.status !== "error") return null;
  if (state.broken.length > 0) {
    const broken = state.broken.map((item) => t(`complexes.status.missing.${item}`)).join(" · ");
    return <FormStatus tone="error">{`${t("complexes.brokenLead")} ${broken}`}</FormStatus>;
  }
  return <FormStatus tone="error">{t(`developers.errors.${state.error ?? "invalid"}`)}</FormStatus>;
}
