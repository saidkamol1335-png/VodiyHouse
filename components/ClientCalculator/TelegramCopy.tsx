"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { CalcLocale } from "@/components/PaymentCalculator/calcText";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import type { TelegramCopyControl } from "./useTelegramCopy";

type TelegramCopyProps = {
  control: TelegramCopyControl;
  language: CalcLocale;
  onLanguage: (language: CalcLocale) => void;
  onCopy: () => void;
  /** В липкой полосе телефона — кнопка и ответ строкой, без выбора языка. */
  compact?: boolean;
};

/** «Скопировать для Telegram» (мокап r1): язык сообщения RU | UZ, кнопка, ответ строкой. */
export function TelegramCopy({
  control,
  language,
  onLanguage,
  onCopy,
  compact = false,
}: TelegramCopyProps) {
  const t = useTranslations("calc");
  const { status, pending } = control;
  const button = (
    <Button
      variant={compact ? "primary" : "ghost"}
      block={!compact}
      pending={pending}
      onClick={onCopy}
    >
      <Copy size={16} aria-hidden="true" />
      {t("telegram.copy")}
    </Button>
  );
  if (compact) {
    // В полосе итог не виден — ответ «Скопировано» здесь же, под кнопкой.
    return (
      <div className="telegram-copy telegram-copy--compact">
        {button}
        {status ? <FormStatus tone={status.tone}>{status.text}</FormStatus> : null}
      </div>
    );
  }
  return (
    <div className="telegram-copy">
      <LanguageChoice value={language} onChange={onLanguage} />
      {button}
      {status ? <FormStatus tone={status.tone}>{status.text}</FormStatus> : null}
      {status?.manual ? (
        <textarea
          className="telegram-copy__manual"
          readOnly
          value={status.manual}
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
