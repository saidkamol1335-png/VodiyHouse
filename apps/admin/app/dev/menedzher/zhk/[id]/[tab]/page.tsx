import { MANAGER_STAND, redirectStandTab } from "../../../../zhk/stand";

export const instant = false;

type DevManagerTabPageProps = { params: Promise<{ id: string; tab: string }> };

// «Блоки», «Планировки», «Фото», «Журнал» менеджеру закрыты — перекидывают на «Квартиры»
// (у «Квартир» своя страница: статичный сегмент важнее [tab]).
export default async function DevManagerTabPage({ params }: DevManagerTabPageProps) {
  const { id, tab } = await params;
  redirectStandTab(MANAGER_STAND, id, tab);
}
