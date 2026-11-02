import { ComplexPreviewTab } from "@/components/ComplexPreviewTab";
import { previewLinkAction } from "@/lib/admin/actions/preview";
import { complexForTab } from "@/lib/admin/server/complexPage";

export const instant = false;

/** Вкладка «Предпросмотр» (шаг 3.6 → PLAN §10): страница ЖК на сайте по гранту кабинета. */
export default async function ComplexPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "preview");
  if (!complex) return null;
  return <ComplexPreviewTab key={complex.id} complexId={complex.id} link={previewLinkAction} />;
}
