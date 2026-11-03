import { notFound } from "next/navigation";
import { ComplexDetailsForm } from "@/components/ComplexDetailsForm";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { ComplexVideosForm } from "@/components/ComplexVideosForm";
import { demoDetails, demoVideos } from "@/lib/admin/complexes/demoContent";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoSaveDetailsAction, demoSaveVideosAction } from "../../contentActions";
import { demoMainFormProps } from "../../demoMainForm";
import { HEAD_STAND } from "../../stand";

export const instant = false;

/** Вкладка «О ЖК» на DEMO: описание, детали (тексты у Namuna), видео (строки добавляются в браузере). */
export default async function DevComplexAboutPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return (
    <>
      <ComplexMainForm key={`${complex.id}-about`} section="about" {...await demoMainFormProps(complex, HEAD_STAND.base)} />
      <ComplexDetailsForm key={`${complex.id}-details`} complexId={complex.id} details={demoDetails(complex.id)} photos={[]} action={demoSaveDetailsAction} />
      <ComplexVideosForm key={`${complex.id}-videos`} complexId={complex.id} videos={demoVideos()} action={demoSaveVideosAction} />
    </>
  );
}
