import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ComplexRecord } from "../complexes/record";
import { readComplex, readReadiness } from "./complexes";

// Страница ЖК: layout (шапка, статус, вкладки) и вкладка читают один и тот же ЖК и готовность —
// один раз на запрос (React.cache), как у застройщика.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null — адрес не uuid или ЖК нет (notFound). */
export const getComplex = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  return readComplex(await createSupabaseServerClient(), id.toLowerCase());
});

export const getComplexReadiness = cache(async (id: string) =>
  readReadiness(await createSupabaseServerClient(), id),
);

/**
 * Вкладка ЖК сама проверяет руководителя: переход между вкладками не перерисовывает layout.
 * null — показывать нечего (отказ и «база не подключена» уже показал layout).
 */
export async function complexForTab(
  params: Promise<{ id: string }>,
): Promise<ComplexRecord | null> {
  const { allowed } = await requireSection("complexes");
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return null;
  const complex = await getComplex((await params).id);
  if (!complex) notFound();
  return complex;
}
