import { FlatStand } from "../stand";

export const instant = false;

type DevFlatUzPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// «Расчёт для этой квартиры» на DEMO (шаг 2.7), по-узбекски.
export default async function DevFlatUzPage({ searchParams }: DevFlatUzPageProps) {
  return <FlatStand search={await searchParams} locale="uz" />;
}
