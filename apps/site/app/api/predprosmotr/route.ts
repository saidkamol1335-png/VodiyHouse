import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { requireActionViewer } from "@/lib/admin/session";
import { isLocale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";

// Предпросмотр ЖК (шаг 3.6, draftMode): кабинет открывает этот адрес — руководителю включается
// режим предпросмотра и он попадает на настоящую страницу ЖК, черновик тоже. Сам черновик база
// отдаёт только руководителю (site_complex): кука предпросмотра одна его не откроет.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (body: string, status: number) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("zhk") ?? "";
  const lang = params.get("lang") ?? "ru";
  if (!UUID.test(id) || !isLocale(lang)) return text("Неверная ссылка предпросмотра", 400);
  // GET, а не POST: ссылку открывают вкладкой и во фрейме кабинета. Включает только предпросмотр.
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) {
    // Вход — только без сессии и не во фрейме: кабинет во фрейме не открывается (X-Frame-Options).
    const framed = request.headers.get("sec-fetch-dest") === "iframe";
    if (guard.code === "session" && !framed) redirect("/admin/vhod");
    if (guard.code === "session") return text("Сессия закончилась — войдите в кабинет заново", 401);
    if (guard.code === "forbidden") return text("Предпросмотр открывает руководитель", 403);
    return text("Кабинет временно недоступен — попробуйте ещё раз", 503);
  }
  const { data, error } = await guard.supabase.from("complexes").select("slug").eq("id", id).maybeSingle();
  if (error) return text("База недоступна — попробуйте ещё раз", 503);
  if (!data?.slug) return text("ЖК не найден", 404);
  (await draftMode()).enable();
  // Адрес — из базы, не из запроса: открытого перенаправления нет.
  redirect(`/${lang}${complexRoute(data.slug)}`);
}
