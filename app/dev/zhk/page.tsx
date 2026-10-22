import { ComplexesStand, HEAD_STAND } from "./stand";

export const instant = false;

type DevComplexesPageProps = { searchParams: Promise<{ zastroyshchik?: string | string[] }> };

// Стенд «ЖК» (шаг 11) на DEMO мокапа: те же компоненты, что у /admin/zhk, без базы.
// В продакшене страницы нет.
export default async function DevComplexesPage({ searchParams }: DevComplexesPageProps) {
  return <ComplexesStand stand={HEAD_STAND} scopeId={(await searchParams).zastroyshchik} />;
}
