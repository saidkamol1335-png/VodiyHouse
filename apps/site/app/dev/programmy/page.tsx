import { DEV_VIEWER } from "@/lib/admin/access";
import { ProgramsListStand } from "./stand";

export const instant = false;

type DevProgramsPageProps = { searchParams: Promise<{ developer?: string | string[] }> };

// Список программ руководителя (шаг 2.4): тумблеры, правка, курс — на DEMO мокапа.
export default async function DevProgramsPage({ searchParams }: DevProgramsPageProps) {
  return (
    <ProgramsListStand
      viewer={DEV_VIEWER}
      base="/dev/programmy"
      developer={(await searchParams).developer}
    />
  );
}
