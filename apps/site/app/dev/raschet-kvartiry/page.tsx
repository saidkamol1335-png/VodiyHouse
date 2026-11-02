import { FlatStand } from "./stand";

export const instant = false;

type DevFlatPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// «Расчёт для этой квартиры» на DEMO (шаг 2.7), по-русски.
export default async function DevFlatPage({ searchParams }: DevFlatPageProps) {
  return <FlatStand search={await searchParams} locale="ru" />;
}
