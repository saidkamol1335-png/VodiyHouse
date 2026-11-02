import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import { SLUG } from "@/lib/site/complex/read";
import { grantedSlug, PREVIEW_COOKIE, PREVIEW_MAX_AGE_SECONDS, PREVIEW_TOKEN } from "@/lib/supabase/preview";

// Вход в предпросмотр из кабинета (PLAN §10): /preview/zhk/<slug>?token=…&lang=ru. Предпросмотр
// включается, только если база подтвердила грант именно этого ЖК (выдуманный токен — 400, кэш
// сайта не обходится). Ссылка не индексируется.
const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });

export async function GET(request: Request, { params }: RouteContext<"/preview/zhk/[slug]">) {
  const { slug } = await params;
  const search = new URL(request.url).searchParams;
  const token = search.get("token") ?? "";
  const lang = search.get("lang") ?? "ru";
  if (!SLUG.test(slug) || !PREVIEW_TOKEN.test(token) || !isLocale(lang)) return text("Неверная ссылка предпросмотра", 400);
  if ((await grantedSlug(token)) !== slug) return text("Ссылка предпросмотра устарела — откройте её из кабинета заново", 400);
  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: PREVIEW_MAX_AGE_SECONDS,
  });
  // Адрес собран из проверенного slug — открытого перенаправления нет.
  redirect(`/${lang}${complexRoute(slug)}`);
}
