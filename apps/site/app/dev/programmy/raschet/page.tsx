import { ClientCalcStand } from "../stand";

export const instant = false;

type DevClientCalcPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// «Расчёт для клиента» (шаг 2.5) на DEMO: квартиры и программы мокапа, скидки кабинета.
export default async function DevClientCalcPage({ searchParams }: DevClientCalcPageProps) {
  return <ClientCalcStand search={await searchParams} />;
}
