import { Eye } from "lucide-react";
import { draftMode } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ComplexPage } from "@/lib/site/complex/model";

/**
 * Пометка предпросмотра (шаг 3.6): видна только в режиме предпросмотра сотрудника — «Черновик:
 * посетители страницу не видят» и выход в кабинет. Плавает поверх страницы и не сдвигает её:
 * предпросмотр выглядит как опубликованная страница.
 */
export async function ComplexPreviewBanner({ page }: { page: Pick<ComplexPage, "id" | "status"> }) {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null;
  const t = await getTranslations("complex.preview");
  const status = page.status === "published" ? t("published") : t("hidden");
  return (
    <aside className="complex-preview" aria-label={t("label")}>
      <Eye size={16} aria-hidden="true" />
      <span>
        <b>{t("label")}</b> · {status}
      </span>
      {/* Из фрейма кабинета выход открывает кабинет во всём окне, а не внутри фрейма. */}
      <a className="complex-preview__exit" href={`/api/predprosmotr/vyhod?zhk=${page.id}`} target="_top">
        {t("exit")}
      </a>
    </aside>
  );
}
