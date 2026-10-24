import { DEV_MANAGER, ProgramsListStand } from "../../programmy/stand";

export const instant = false;

type DevManagerProgramsPageProps = { searchParams: Promise<{ developer?: string | string[] }> };

// Стенд «Программ оплаты» менеджера: те же карточки без тумблеров, правки и курса (PLAN §5).
export default async function DevManagerProgramsPage({
  searchParams,
}: DevManagerProgramsPageProps) {
  return (
    <ProgramsListStand
      viewer={DEV_MANAGER}
      base="/dev/menedzher/programmy"
      developer={(await searchParams).developer}
    />
  );
}
