"use client";

import { ArrowDown, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { CalcLead, type CalcLeadRow } from "@/components/CalcLead";
import { FormStatus } from "@/components/FormStatus";
import { programName, termText } from "@/components/PaymentCalculator/calcText";
import type { CalcSnapshot } from "@/components/PaymentCalculator/PaymentCalculator";
import { calcTelegramText } from "@/components/PaymentCalculator/telegramText";
import type { SiteCalcScreen } from "@/lib/calc/siteScreen";
import type { CalcProgram } from "@/lib/calc/programs";
import { formatPercent } from "@/lib/format";

type Current = NonNullable<SiteCalcScreen["current"]>;

type SiteActionsProps = {
  snapshot: CalcSnapshot<CalcProgram>;
  current: Current;
  /** «Получить точный расчёт» — до заявок фазы 3 только на стенде (решение фазы 2). */
  leadEnabled: boolean;
};

/** Что попадёт в заявку: программа, стоимость, взнос, срок, платёж — строками итога. */
function leadRows(snapshot: CalcSnapshot<CalcProgram>): CalcLeadRow[] {
  const { view, total, context } = snapshot;
  const { t, locale } = context;
  const calc = view.result?.ok ? view.result.calculation : null;
  if (!view.selected || !calc) return [];
  const price = total.rows.find((row) => row.key === "price");
  return [
    { label: t("programs.title"), value: programName(view.selected, t, locale) },
    ...(price ? [{ label: price.label, value: price.value }] : []),
    { label: t("down.title"), value: formatPercent(calc.downPct) },
    ...(calc.months > 0 ? [{ label: t("term.title"), value: termText(calc.months, t) }] : []),
    ...(total.head ? [{ label: total.head.label, value: total.head.value }] : []),
  ];
}

/** Кнопки итога сайта (мокап SiteCalc): «Получить точный расчёт» и «Скопировать для Telegram». */
export function SiteActions({ snapshot, current, leadEnabled }: SiteActionsProps) {
  const { view, total, context } = snapshot;
  const source = {
    stock: current.data.stock,
    developerName: current.name,
    actualAt: current.checkedAt,
  };
  const leadContext = total.head ? `${total.eyebrow} · ${total.head.value}` : total.eyebrow;
  return (
    <>
      {leadEnabled && view.selected ? (
        <CalcLead id="site-calc-lead" context={leadContext} rows={leadRows(snapshot)} />
      ) : null}
      <SiteTelegramCopy
        message={calcTelegramText(view, source, context)}
        withLink={() => calcTelegramText(view, { ...source, link: window.location.href }, context)}
      />
    </>
  );
}

type Status = { tone: "success" | "error"; text: string; message: string; manual: boolean } | null;

type SiteTelegramCopyProps = {
  /** Текст расчёта сейчас (без ссылки): ответ на прошлое копирование — только про него. */
  message: string | null;
  /** Тот же текст со ссылкой на расчёт — адрес страницы известен только в браузере. */
  withLink: () => string | null;
};

/** Текст в буфер; буфер недоступен — текст в поле, чтобы скопировать руками. Снимка нет (заявка — фаза 3). */
function SiteTelegramCopy({ message, withLink }: SiteTelegramCopyProps) {
  const t = useTranslations("calc");
  const [saved, setStatus] = useState<Status>(null);
  const status = saved?.message === message ? saved : null;
  const copy = async () => {
    const text = withLink();
    if (!text || !message) return;
    const copied = await navigator.clipboard?.writeText(text).then(
      () => true,
      () => false,
    );
    setStatus(
      copied
        ? { tone: "success", text: t("telegram.copied"), message, manual: false }
        : { tone: "error", text: t("telegram.failed"), message, manual: true },
    );
  };
  return (
    <div className="site-calculator__copy">
      <Button variant="outline" block onClick={copy}>
        <Copy size={16} aria-hidden="true" />
        {t("telegram.copy")}
      </Button>
      {status ? <FormStatus tone={status.tone}>{status.text}</FormStatus> : null}
      {status?.manual ? (
        <textarea
          className="site-calculator__manual"
          readOnly
          value={withLink() ?? status.message}
          aria-label={t("telegram.copy")}
        />
      ) : null}
    </div>
  );
}

/** В липкой полосе телефона (В7 B): «К расчёту ↓» — к итогу со строками и кнопками. */
export function ToTotal() {
  const t = useTranslations("calc.sticky");
  return (
    <Button
      onClick={() =>
        document.querySelector("[data-testid=calc-total]")?.scrollIntoView({ block: "start" })
      }
    >
      {t("toTotal")}
      <ArrowDown size={16} aria-hidden="true" />
    </Button>
  );
}
