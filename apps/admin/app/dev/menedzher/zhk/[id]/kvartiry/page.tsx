import { MANAGER_STAND } from "../../../../zhk/stand";
import { UnitsStand } from "../../../../zhk/unitsStand";

export const instant = false;

type DevManagerUnitsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blok?: string | string[]; demo?: string | string[] }>;
};

/** «Квартиры» менеджера на DEMO: список и статус, Н7; без генератора, стояков и правок. */
export default async function DevManagerUnitsPage({
  params,
  searchParams,
}: DevManagerUnitsPageProps) {
  const [{ id }, { blok, demo }] = await Promise.all([params, searchParams]);
  return <UnitsStand stand={MANAGER_STAND} id={id} blok={blok} demo={demo} />;
}
