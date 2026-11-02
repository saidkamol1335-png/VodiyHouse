import { MANAGER_STAND, redirectStandTab } from "../../../zhk/stand";

export const instant = false;

// «Основное» менеджеру закрыто — как у /admin/zhk/<id>: перекидывает на «Квартиры».
export default async function DevManagerComplexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirectStandTab(MANAGER_STAND, (await params).id, null);
}
