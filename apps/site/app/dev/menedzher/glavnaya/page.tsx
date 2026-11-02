import { MANAGER_STAND } from "../../zhk/stand";
import { HomeStand } from "../../glavnaya/stand";

export const instant = false;

type DevManagerHomePageProps = { searchParams: Promise<{ demo?: string | string[] }> };

// Стенд главной менеджера (шаг 13): те же «Остатки по ЖК», «Квартиры →» — на стенд менеджера.
export default async function DevManagerHomePage({ searchParams }: DevManagerHomePageProps) {
  return <HomeStand stand={MANAGER_STAND} demo={(await searchParams).demo} />;
}
