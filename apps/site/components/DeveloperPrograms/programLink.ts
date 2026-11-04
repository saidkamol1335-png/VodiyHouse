import type { ProgramOption } from "@vh/shared/calc/options";
import type { CalcProgram } from "@vh/shared/calc/programs";
import { complexRoute } from "@/lib/routes";

// «Рассчитать платёж» у программы застройщика (PLAN §10, п. 48): программы считает калькулятор
// квартиры на странице ЖК, а /kalkulyator — риелторский, без программ.

/** Якорь «Объекты» этой же страницы: ЖК под программу несколько — выбрать посетителю. */
export const DEVELOPER_OBJECTS_ANCHOR = "obekty";

export type ProgramComplex = { slug: string; blockIds: readonly string[] };

/** Один ЖК под программу — его планировки; несколько — «Объекты» застройщика; ни одного — без ссылки. */
export function programHref(
  option: Pick<ProgramOption<CalcProgram>, "blocksScope" | "blockIds">,
  complexes: readonly ProgramComplex[],
): string | null {
  const fits = complexes.filter(
    (complex) =>
      option.blocksScope === "all" || complex.blockIds.some((id) => option.blockIds.includes(id)),
  );
  if (fits.length === 0) return null;
  if (fits.length === 1) return `${complexRoute(fits[0]!.slug)}#planirovki`;
  return `#${DEVELOPER_OBJECTS_ANCHOR}`;
}
