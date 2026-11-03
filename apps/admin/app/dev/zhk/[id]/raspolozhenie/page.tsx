import { notFound } from "next/navigation";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoMainFormProps } from "../../demoMainForm";
import { HEAD_STAND } from "../../stand";

export const instant = false;

/** Вкладка «Расположение» на DEMO. */
export default async function DevComplexLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return <ComplexMainForm key={complex.id} section="location" {...await demoMainFormProps(complex, HEAD_STAND.base)} />;
}
