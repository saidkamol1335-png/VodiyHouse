import { ClientCalcStand } from "../../../programmy/stand";

export const instant = false;

type DevManagerCalcPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// «Расчёт для клиента» менеджера на DEMO — тот же экран, что у руководителя (PLAN §3б).
export default async function DevManagerCalcPage({ searchParams }: DevManagerCalcPageProps) {
  return <ClientCalcStand search={await searchParams} />;
}
