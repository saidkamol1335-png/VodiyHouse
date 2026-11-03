import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import DevComplexAboutPage from "../../../../zhk/[id]/o-zhk/page";
import DevComplexBlocksPage from "../../../../zhk/[id]/bloki/page";
import DevComplexDocumentsPage from "../../../../zhk/[id]/dokumenty/page";
import DevComplexPhotosPage from "../../../../zhk/[id]/foto/page";
import DevComplexLayoutsPage from "../../../../zhk/[id]/planirovki/page";
import DevComplexLocationPage from "../../../../zhk/[id]/raspolozhenie/page";
import { MANAGER_STAND, StandPublication } from "../../../../zhk/stand";

export const instant = false;

type DevManagerTabPageProps = {
  params: Promise<{ id: string; tab: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type TabPage = ComponentType<{
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

// Вкладки менеджера — те же страницы DEMO, что у руководителя (PLAN §10, п. 6); «Публикация» — со
// своими кнопками: запрос руководителю вместо статуса. «Квартиры» — своя страница (статичный сегмент).
const TABS: Record<string, TabPage> = {
  "o-zhk": DevComplexAboutPage,
  bloki: DevComplexBlocksPage,
  planirovki: DevComplexLayoutsPage,
  foto: DevComplexPhotosPage,
  raspolozhenie: DevComplexLocationPage,
  dokumenty: DevComplexDocumentsPage,
};

export default async function DevManagerTabPage({ params, searchParams }: DevManagerTabPageProps) {
  const { id, tab } = await params;
  if (tab === "publikatsiya") return <StandPublication stand={MANAGER_STAND} id={id} />;
  const Page = Object.hasOwn(TABS, tab) ? TABS[tab] : undefined;
  if (!Page) notFound();
  return <Page params={Promise.resolve({ id })} searchParams={searchParams} />;
}
