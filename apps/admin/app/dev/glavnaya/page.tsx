import { HEAD_STAND } from "../zhk/stand";
import { HomeStand } from "./stand";

export const instant = false;

type DevHomePageProps = { searchParams: Promise<{ demo?: string | string[] }> };

// Стенд главной кабинета руководителя (шаг 13) на DEMO: «Остатки по ЖК» без базы.
export default async function DevHomePage({ searchParams }: DevHomePageProps) {
  return <HomeStand stand={HEAD_STAND} demo={(await searchParams).demo} />;
}
