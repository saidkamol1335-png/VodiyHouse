import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { complexCompleteness, type ComplexCompleteness, type ComplexCompletenessRecord } from "../complexes/completeness";
import type { ComplexRecord } from "../complexes/record";
import {
  canOpenComplex,
  complexAccess,
  complexTabRedirect,
  type ComplexTabKey,
} from "../complexes/tabs";
import { ADMIN_ROUTES } from "../nav";
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

/** Полнота ЖК и планировок (правило публикации v2); null — ЖК не виден этой роли. */
export const getComplexCompleteness = cache(async (id: string): Promise<ComplexCompleteness | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complex_completeness", { p_complex: id });
  if (error) throw new Error("complex-completeness-unavailable", { cause: error });
  return data ? complexCompleteness(data as ComplexCompletenessRecord) : null;
});

/**
 * Вкладка ЖК сама проверяет сотрудника: переход между вкладками не перерисовывает layout.
 * Закрытая роли вкладка (менеджеру — всё, кроме «Квартир», Н2) перекидывает на открытую.
 * null — показывать нечего (отказ и «база не подключена» уже показал layout).
 */
export async function complexForTab(
  params: Promise<{ id: string }>,
  tab: ComplexTabKey,
): Promise<ComplexRecord | null> {
  const { viewer, allowed } = await requireSection("complexes");
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return null;
  const complex = await getComplex((await params).id);
  if (!complex || !canOpenComplex(complexAccess(viewer.role), complex.status)) notFound();
  const elsewhere = complexTabRedirect(viewer.role, `${ADMIN_ROUTES.complexes}/${complex.id}`, tab);
  if (elsewhere) redirect(elsewhere);
  return complex;
}
