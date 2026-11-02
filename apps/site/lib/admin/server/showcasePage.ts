import "server-only";
import { notFound } from "next/navigation";
import type { ShowcaseListItem } from "@/components/ShowcaseList";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { NEW_SHOWCASE_ID } from "@/lib/admin/nav";
import { requireSection } from "@/lib/admin/session";
import type { ShowcaseKind, ShowcaseListRow } from "@/lib/admin/showcase/types";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mediaSrc } from "./developerPage";
import { readShowcaseRows } from "./showcase";

// Страницы «Витрины» (3.16а): вкладка сама проверяет руководителя — переход между вкладками не
// перерисовывает layout (там отказ и «база не подключена» уже показаны).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** false — показывать нечего: нет права или облака. */
export async function showcaseOpen(): Promise<boolean> {
  const { allowed } = await requireSection("showcase");
  return allowed && !isCabinetOpenWithoutLogin && hasSupabaseEnv();
}

/** Адрес записи: uuid (правка) или «novoe» (создание); иное — 404. */
export async function showcaseEntityId(params: Promise<{ id: string }>): Promise<string | null> {
  const { id } = await params;
  if (id === NEW_SHOWCASE_ID) return null;
  if (!UUID.test(id)) notFound();
  return id.toLowerCase();
}

function withCover(row: ShowcaseListRow): ShowcaseListItem {
  return { ...row, coverSrc: row.coverPath ? mediaSrc(row.coverPath) : null };
}

/** Строки вкладки с адресами обложек для списка. */
export async function readShowcaseList(kind: ShowcaseKind): Promise<ShowcaseListItem[]> {
  const rows = await readShowcaseRows(await createSupabaseServerClient(), kind);
  return rows.map(withCover);
}
