import { DEV_VIEWER } from "@/lib/admin/access";
import { ProgramsStand } from "./stand";

export const instant = false;

type DevProgramsPageProps = { searchParams: Promise<{ developer?: string | string[] }> };

// Стенд «Программ оплаты» руководителя (шаг 2.4): тумблеры, правка, курс — на DEMO мокапа.
export default async function DevProgramsPage({ searchParams }: DevProgramsPageProps) {
  return <ProgramsStand viewer={DEV_VIEWER} developer={(await searchParams).developer} />;
}
