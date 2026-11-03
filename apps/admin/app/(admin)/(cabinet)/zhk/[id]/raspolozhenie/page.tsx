import { ComplexMainForm } from "@/components/ComplexMainForm";
import { saveComplexMainAction } from "@/lib/admin/actions/complexes";
import { complexMainFormProps } from "@/lib/admin/server/complexMainForm";
import { complexForTab } from "@/lib/admin/server/complexPage";

export const instant = false;

/** Вкладка «Расположение» (экран 3): город или район, адрес, ориентир, точка на карте, «Что рядом». */
export default async function ComplexLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "location");
  if (!complex) return null;
  return (
    <ComplexMainForm
      key={complex.id}
      section="location"
      action={saveComplexMainAction}
      {...await complexMainFormProps(complex)}
    />
  );
}
