"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { ChoiceField } from "@/components/ChoiceField";

type Language = "ru" | "uz";

type ComplexPreviewTabProps = {
  /** Адрес предпросмотра на языке: в кабинете — /api/predprosmotr (включает draftMode). */
  hrefs: Record<Language, string>;
};

/**
 * Вкладка «Предпросмотр» (шаг 3.6): настоящая страница ЖК — на телефоне во фрейме 390 px, на весь
 * экран — новой вкладкой (1440). Черновик видит только сотрудник (site_complex по сессии).
 */
export function ComplexPreviewTab({ hrefs }: ComplexPreviewTabProps) {
  const t = useTranslations("admin.complexes.preview");
  const [language, setLanguage] = useState<Language>("ru");
  return (
    <AdminPanel title={t("title")} wide>
      <div className="complex-preview-tab">
        <p className="complex-preview-tab__lead">{t("lead")}</p>
        <div className="complex-preview-tab__tools">
          <ChoiceField
            id="complex-preview-language"
            name="complex-preview-language"
            label={t("language")}
            options={[
              { value: "ru", label: "RU" },
              { value: "uz", label: "UZ" },
            ]}
            value={language}
            onChange={(value) => setLanguage(value as Language)}
          />
          <a className="complex-preview-tab__open" href={hrefs[language]} target="_blank" rel="noopener">
            {t("open")}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
        <iframe key={language} className="complex-preview-tab__phone" src={hrefs[language]} title={t("frame")} loading="lazy" />
      </div>
    </AdminPanel>
  );
}
