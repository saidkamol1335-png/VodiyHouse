import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

// «Выйти из предпросмотра» (шаг 3.6): снимает куку предпросмотра и ведёт на ЖК в кабинете.
// Только выключает — без входа и без чтения базы; GET — кнопка-ссылка из шапки предпросмотра.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("zhk") ?? "";
  (await draftMode()).disable();
  redirect(UUID.test(id) ? `${ADMIN_ROUTES.complexes}/${id}` : ADMIN_ROUTES.complexes);
}
