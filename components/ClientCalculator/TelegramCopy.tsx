"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { CalcLocale } from "@/lib/calc/text";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import type { TelegramCopyControl } from "./useTelegramCopy";

type TelegramCopyProps = {
  control: TelegramCopyControl;
  language: CalcLocale;
  onLanguage: (language: CalcLocale) => void;
  /** Текст, который сейчас уйдёт в буфер: ответ на прошлое копирование — только про него. */
  message: string | null;
  onCopy: () => void;
  /** В липкой полосе телефона — одна кнопка; ответ — её подписью (высота полосы не меняется). */
  compact?: boolean;
};

/** «Скопировать для Telegram» (мокап r1): язык сообщения RU | UZ, кнопка, ответ строкой. */
export function TelegramCopy(props: TelegramCopyProps) {
  const t = useTranslations("calc");
  const { pending } = props.control;
  const status = props.control.status?.message === props.message ? props.control.status : null;
  if (props.compact) {
    const label = !status
      ? t("telegram.copy")
      : status.tone === "success"
        ? t("telegram.copiedShort")
        : t("telegram.failedShort");
    return (
      <Button pending={pending} onClick={props.onCopy}>
        <Copy size={16} aria-hidden="true" />
        <span role="status">{label}</span>
      </Button>
    );
  }
  return (
    <div className="telegram-copy">
      <LanguageChoice value={props.language} onChange={props.onLanguage} />
      <Button variant="outline" block pending={pending} onClick={props.onCopy}>
        <Copy size={16} aria-hidden="true" />
        {t("telegram.copy")}
      </Button>
      {status ? <FormStatus tone={status.tone}>{status.text}</FormStatus> : null}
      {status?.manual ? (
        <textarea
          className="telegram-copy__manual"
          readOnly
          value={status.message}
          aria-label={t("telegram.copy")}
        />
      ) : null}
    </div>
  );
}

function LanguageChoice({
  value,
  onChange,
}: {
  value: CalcLocale;
  onChange: (language: CalcLocale) => void;
}) {
  const t = useTranslations("admin.calc");
  return (
    <Segmented label={t("language")} className="telegram-copy__language">
      {(["ru", "uz"] as const).map((language) => (
        <button
          key={language}
          type="button"
          className={segmentedItemClass(language === value)}
          aria-pressed={language === value}
          onClick={() => onChange(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </Segmented>
  );
}
