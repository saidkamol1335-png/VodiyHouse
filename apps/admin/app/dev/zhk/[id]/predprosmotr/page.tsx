import { notFound } from "next/navigation";
import { ComplexPreviewTab } from "@/components/ComplexPreviewTab";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoPreviewLinkAction } from "../../previewActions";

export const instant = false;

/** «Предпросмотр» на DEMO: окно 390 или вкладка 1440 с опубликованной DEMO-страницей сайта. */
export default async function DevComplexPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return <ComplexPreviewTab key={complex.id} complexId={complex.id} link={demoPreviewLinkAction} />;
}
