import { ComplexMainForm } from "@/components/ComplexMainForm";
import { saveComplexMainAction } from "@/lib/admin/actions/complexes";
import { complexMainFormProps } from "@/lib/admin/server/complexMainForm";
import { complexForTab } from "@/lib/admin/server/complexPage";

export const instant = false;

/** Вкладка «Основное» (экран 3): название, застройщик, класс, дом, потолки, парковка. */
export default async function ComplexMainPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "main");
  if (!complex) return null;
  return (
    <ComplexMainForm
      key={complex.id}
      section="main"
      action={saveComplexMainAction}
      {...await complexMainFormProps(complex)}
    />
  );
}
