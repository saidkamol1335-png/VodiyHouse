import { ComplexPreviewTab } from "@/components/ComplexPreviewTab";
import { complexForTab } from "@/lib/admin/server/complexPage";

export const instant = false;

const previewHref = (id: string, lang: "ru" | "uz") => `/api/predprosmotr?zhk=${id}&lang=${lang}`;

/** Вкладка «Предпросмотр» (шаг 3.6): настоящая страница ЖК в режиме предпросмотра. */
export default async function ComplexPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "preview");
  if (!complex) return null;
  return <ComplexPreviewTab key={complex.id} hrefs={{ ru: previewHref(complex.id, "ru"), uz: previewHref(complex.id, "uz") }} />;
}
