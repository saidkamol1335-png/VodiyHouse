"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { CalcLocale } from "@/lib/calc/text";
import type { CalcSnapshot } from "@/components/PaymentCalculator/PaymentCalculator";
import { NETWORK_FAILURE, type ProgramActionResult } from "@/lib/admin/programs/types";
import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import { settle } from "@/lib/ui/settle";

export type SaveCalculation = (formData: FormData) => Promise<ProgramActionResult<string>>;

/**
 * Ответ на «Скопировать»: относится к тексту message — расчёт поменялся, ответ уже не про него.
 * manual — буфер обмена недоступен: этот текст показываем в поле, чтобы скопировать руками.
 */
export type CopyStatus = {
  tone: "success" | "error";
  text: string;
  message: string;
  manual: boolean;
} | null;

/** Снимок для истории (решение фазы 2): что посчитали; условия и курс база возьмёт сама. */
function snapshotForm(snapshot: CalcSnapshot<CabinetProgram>, language: CalcLocale): FormData {
  const { view, params } = snapshot;
  const form = new FormData();
  form.append("program", view.selected?.id ?? "");
  form.append("unit", view.price.unitId ?? "");
  form.append("input", JSON.stringify({ params, price: view.price, language }));
  form.append("result", JSON.stringify(view.result?.ok ? view.result.calculation : {}));
  return form;
}

/**
 * «Скопировать для Telegram»: текст в буфер, снимок — в историю. Буфер не дался — текст в поле;
 * снимок не сохранился — текст всё равно скопирован, строкой сказано, что истории нет.
 */
export function useTelegramCopy(save: SaveCalculation) {
  const t = useTranslations("calc");
  const tAdmin = useTranslations("admin");
  const [status, setStatus] = useState<CopyStatus>(null);
  const [pending, start] = useTransition();
  const copy = (
    snapshot: CalcSnapshot<CabinetProgram>,
    language: CalcLocale,
    message: string | null,
  ) =>
    start(async () => {
      if (!message) return;
      const copied = await navigator.clipboard?.writeText(message).then(
        () => true,
        () => false,
      );
      const saved = await settle(() => save(snapshotForm(snapshot, language)), NETWORK_FAILURE);
      if (!copied) {
        return setStatus({ tone: "error", text: t("telegram.failed"), message, manual: true });
      }
      if (saved.status === "error") {
        const reason = tAdmin(`developers.errors.${(saved.error ?? "unknown") as "unknown"}`);
        const text = tAdmin("calc.notSaved", { reason });
        return setStatus({ tone: "error", text, message, manual: false });
      }
      setStatus({ tone: "success", text: t("telegram.copied"), message, manual: false });
    });
  return { status, pending, copy };
}

export type TelegramCopyControl = ReturnType<typeof useTelegramCopy>;
