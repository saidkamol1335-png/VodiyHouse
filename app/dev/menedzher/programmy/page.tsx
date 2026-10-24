import type { CabinetViewer } from "@/lib/admin/access";
import { ProgramsStand } from "../../programmy/stand";

export const instant = false;

const DEV_MANAGER: CabinetViewer = {
  id: "dev-manager",
  role: "manager",
  name: null,
  mustChangePassword: false,
};

type DevManagerProgramsPageProps = { searchParams: Promise<{ developer?: string | string[] }> };

// Стенд «Программ оплаты» менеджера: те же карточки без тумблеров, правки и курса (PLAN §5).
export default async function DevManagerProgramsPage({
  searchParams,
}: DevManagerProgramsPageProps) {
  return <ProgramsStand viewer={DEV_MANAGER} developer={(await searchParams).developer} />;
}
