import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import { SLUG } from "@/lib/site/complex/read";
import { PREVIEW_COOKIE } from "@/lib/supabase/preview";

// Выход из предпросмотра: та же страница ЖК глазами посетителя (черновик — 404). В кабинет сайт не
// ведёт (PLAN §10, п. 19): вкладку предпросмотра закрывают.
export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const slug = search.get("zhk") ?? "";
  const lang = search.get("lang") ?? "ru";
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect(SLUG.test(slug) && isLocale(lang) ? `/${lang}${complexRoute(slug)}` : `/${isLocale(lang) ? lang : "uz"}`);
}
