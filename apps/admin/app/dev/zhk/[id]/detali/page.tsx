import { notFound } from "next/navigation";
import { ComplexDetailsForm } from "@/components/ComplexDetailsForm";
import { demoDetails } from "@/lib/admin/complexes/demoContent";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoSaveDetailsAction } from "../../contentActions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета.
export const instant = false;

/** Вкладка «Детали» на DEMO: тексты у Namuna; фото у DEMO стенда нет (галерея — в облаке). */
export default async function DevComplexDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return <ComplexDetailsForm key={complex.id} complexId={complex.id} details={demoDetails(complex.id)} photos={[]} action={demoSaveDetailsAction} />;
}
