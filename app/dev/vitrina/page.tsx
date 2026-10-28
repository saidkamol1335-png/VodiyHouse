import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { DEV_SHOWCASE_BASE } from "./base";

export const instant = false;

/** Корень стенда «Витрины» — первая вкладка, как у /admin/vitrina (layout стенда закрыт в продакшене). */
export default function DevShowcasePage() {
  redirect(ADMIN_ROUTES.showcaseSpecials.replace(ADMIN_ROUTES.showcase, DEV_SHOWCASE_BASE));
}
