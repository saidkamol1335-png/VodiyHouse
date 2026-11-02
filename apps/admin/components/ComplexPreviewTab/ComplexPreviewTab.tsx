"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { ChoiceField } from "@/components/ChoiceField";
import type { PreviewLinkResult } from "@/lib/admin/previewLink";

type Language = "ru" | "uz";
type Width = 390 | 1440;

type ComplexPreviewTabProps = {
  complexId: string;
  /** Свежая ссылка на сайт с грантом на 15 минут (lib/admin/actions/preview.ts). */
  link: (complexId: string, lang: Language) => Promise<PreviewLinkResult>;
};

/**
 * Вкладка «Предпросмотр» (шаг 3.6 → PLAN §10): настоящая страница ЖК на сайте по гранту кабинета —
 * новым окном 390 (телефон) или вкладкой 1440. Во фрейме нельзя: сайт и кабинет на разных доменах,
 * сайт во фрейме чужого домена не открывается.
 */
export function ComplexPreviewTab({ complexId, link }: ComplexPreviewTabProps) {
  const t = useTranslations("admin.complexes.preview");
  const [language, setLanguage] = useState<Language>("ru");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const open = (width: Width) => {
    // Окно открывается сразу по нажатию (иначе браузер сочтёт его всплывающим), адрес — после ответа.
    const target = window.open("about:blank", "_blank", width === 390 ? "width=390,height=844" : undefined);
    // Окно сайта без ссылки на кабинет (как noopener): сайт не управляет вкладкой кабинета.
    if (target) target.opener = null;
    start(async () => {
      const result = await link(complexId, language);
      setFailed(result.status !== "ok");
      if (result.status === "ok" && target) target.location.href = result.url;
      else target?.close();
    });
  };
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
          {([390, 1440] as const).map((width) => (
            <button key={width} type="button" className="complex-preview-tab__open" onClick={() => open(width)} disabled={pending}>
              {t("openWidth", { width })}
              <ExternalLink size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
        {failed ? <p className="complex-preview-tab__error" role="alert">{t("failed")}</p> : null}
      </div>
    </AdminPanel>
  );
}
