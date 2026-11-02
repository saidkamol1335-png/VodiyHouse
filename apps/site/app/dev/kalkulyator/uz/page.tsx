import { CalculatorStand } from "../stand";

export const instant = false;

type DevCalculatorUzPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// /kalkulyator на DEMO (шаг 2.6), по-узбекски.
export default async function DevCalculatorUzPage({ searchParams }: DevCalculatorUzPageProps) {
  return <CalculatorStand search={await searchParams} locale="uz" />;
}
