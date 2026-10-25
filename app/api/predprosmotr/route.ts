import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { requireActionViewer } from "@/lib/admin/session";
import { isLocale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";

// Предпросмотр ЖК (шаг 3.6, draftMode): кабинет открывает этот адрес — руководителю включается
// режим предпросмотра и он попадает на настоящую страницу ЖК, черновик тоже. Сам черновик база
// отдаёт только сессии сотрудника (site_complex): кука предпросмотра одна его не откроет.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("zhk") ?? "";
  const lang = params.get("lang") ?? "ru";
  if (!UUID.test(id) || !isLocale(lang)) return new Response("Неверная ссылка предпросмотра", { status: 400 });
  // GET, а не POST: ссылку открывают вкладкой и во фрейме кабинета. Включает только предпросмотр.
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) redirect("/admin/vhod");
  const { data, error } = await guard.supabase.from("complexes").select("slug").eq("id", id).maybeSingle();
  if (error) return new Response("База недоступна — попробуйте ещё раз", { status: 503 });
  if (!data?.slug) return new Response("ЖК не найден", { status: 404 });
  (await draftMode()).enable();
  // Адрес — из базы, не из запроса: открытого перенаправления нет.
  redirect(`/${lang}${complexRoute(data.slug)}`);
}
