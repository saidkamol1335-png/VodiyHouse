import { HEAD_STAND, StandPublication } from "../../stand";

export const instant = false;

/** Вкладка «Публикация» на DEMO — руководитель. */
export default async function DevComplexPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  return <StandPublication stand={HEAD_STAND} id={(await params).id} />;
}
