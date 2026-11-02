import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

export const instant = false;

/** Корень «Витрины» — первая вкладка (у каждой вкладки свой сегмент, чтобы она была активна и на странице записи). */
export default function ShowcasePage() {
  redirect(ADMIN_ROUTES.showcaseSpecials);
}
