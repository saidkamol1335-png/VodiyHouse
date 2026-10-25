import { notFound } from "next/navigation";
import { ComplexVideosForm } from "@/components/ComplexVideosForm";
import { demoVideos } from "@/lib/admin/complexes/demoContent";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoSaveVideosAction } from "../../contentActions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета.
export const instant = false;

/** Вкладка «Видео» на DEMO: роликов нет — строки добавляются в браузере. */
export default async function DevComplexVideosPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return <ComplexVideosForm key={complex.id} complexId={complex.id} videos={demoVideos()} action={demoSaveVideosAction} />;
}
