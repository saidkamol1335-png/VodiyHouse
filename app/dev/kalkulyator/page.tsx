import { CalculatorStand } from "./stand";

export const instant = false;

type DevCalculatorPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// /kalkulyator на DEMO (шаг 2.6), по-русски.
export default async function DevCalculatorPage({ searchParams }: DevCalculatorPageProps) {
  return <CalculatorStand search={await searchParams} locale="ru" />;
}
