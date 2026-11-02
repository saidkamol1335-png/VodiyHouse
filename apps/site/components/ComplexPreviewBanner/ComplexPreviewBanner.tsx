import { Eye } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ComplexPage } from "@/lib/site/complex/model";
import { isPreview } from "@/lib/supabase/preview";

/**
 * Пометка предпросмотра (шаг 3.6): видна только в режиме предпросмотра по гранту кабинета — видят ли
 * страницу посетители (ЖК и застройщик опубликованы) и выход. Плавает поверх страницы и не сдвигает
 * её: предпросмотр выглядит как опубликованная страница. В кабинет сайт не ведёт (PLAN §10, п. 19).
 */
export async function ComplexPreviewBanner({ page }: { page: Pick<ComplexPage, "slug" | "status" | "onSite"> }) {
  if (!(await isPreview())) return null;
  const [t, locale] = await Promise.all([getTranslations("complex.preview"), getLocale()]);
  // Опубликованный ЖК скрытого застройщика посетитель тоже не видит (404) — своя подпись.
  const status = page.onSite ? t("published") : page.status === "published" ? t("developerHidden") : t("hidden");
  return (
    <aside className="complex-preview" aria-label={t("label")}>
      <Eye size={16} aria-hidden="true" />
      <span>
        <b>{t("label")}</b> · {status}
      </span>
      <a className="complex-preview__exit" href={`/preview/vyhod?zhk=${page.slug}&lang=${locale}`}>
        {t("exit")}
      </a>
    </aside>
  );
}
