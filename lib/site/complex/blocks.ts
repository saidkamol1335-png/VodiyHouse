import { isTermsProgram, kindOf, maxMonthsOf, minDownOf, type ProgramKind } from "@/lib/calc/programs";
import type { LocalizedText } from "@/lib/contacts";
import { blockPaymentFrom } from "@/lib/site/catalog/payment";
import type { CatalogProgram } from "@/lib/site/catalog/records";
import { quarterOf } from "@/lib/quarters";
import type { ComplexBlock, ComplexPage, DeadlineShift } from "./model";

// Карточка блока «Блоки и условия покупки» (мокап .blk, ТЗ 7.3в): числа и ключи — строки собирает
// компонент из messages. Без скидок (PLAN §3.13): «100% оплата» — без процента, «скидка до …» нет.

export type BlockStatus = { kind: "built" } | { kind: "building"; pct: number | null };

export type BlockCadastre = { kind: "done" } | { kind: "inProgress"; expected: { year: number; quarter: number } | null } | { kind: "afterDelivery" } | null;

/** Строка «Как можно купить»: вид программы, банк, взнос, срок и ставка (наценка) — без скидок. */
export type ProgramLine = {
  id: string;
  kind: ProgramKind;
  /** Знак строки — инициалы банка или застройщика (мокап .mono-b: «IB», «FS»). */
  mark: string;
  bank: LocalizedText | null;
  downPct: number;
  months: number;
  /** Ставка банка или наценка, % — от и до по строкам сроков. */
  rate: { min: number; max: number } | null;
};

export type BlockCard = {
  block: ComplexBlock;
  status: BlockStatus;
  /** «7 из 12 этажей» — только у строящегося с этажностью. */
  floors: { built: number; total: number } | null;
  /** Последний перенос, который привёл к нынешнему сроку: «перенесён с 2 кв. 2027». */
  shift: DeadlineShift | null;
  cadastre: BlockCadastre;
  programs: ProgramLine[];
  payment: number | null;
};

/** «Farg‘ona Sifat Qurilish» → «FS»: апостроф узбекского слова не делит его на два. */
const initials = (name: string) =>
  name
    .replace(/[‘'’]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

function rateRange(entry: CatalogProgram): ProgramLine["rate"] {
  const { program } = entry;
  if (!isTermsProgram(program) || program.terms.length === 0) return null;
  const rates = program.terms.map((term) => term.ratePct);
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

export function programLine(entry: CatalogProgram, developerName: string): ProgramLine {
  const { program } = entry;
  return {
    id: entry.id,
    kind: kindOf({ type: program.type, method: program.type === "full" ? null : program.method }),
    mark: initials(entry.bank?.ru ?? developerName),
    bank: entry.bank,
    downPct: minDownOf(program),
    months: maxMonthsOf(program),
    rate: rateRange(entry),
  };
}

/** Программы застройщика, которые действуют на блок (все блоки или выбранные). */
export function blockPrograms(page: ComplexPage, blockId: string): CatalogProgram[] {
  const developer = page.catalog.developers[0];
  return (developer?.programs ?? []).filter((entry) => entry.blocksScope === "all" || entry.blockIds.includes(blockId));
}

function cadastreOf(block: ComplexBlock): BlockCadastre {
  if (block.cadastre === "done") return { kind: "done" };
  if (block.cadastre === "after_delivery") return { kind: "afterDelivery" };
  if (block.cadastre !== "in_progress") return null;
  const expected = block.cadastreExpectedOn ? quarterOf(block.cadastreExpectedOn) : null;
  return { kind: "inProgress", expected };
}

function shiftOf(block: ComplexBlock): DeadlineShift | null {
  const last = block.history.at(-1);
  if (!last || !block.deadline) return null;
  return last.to.year === block.deadline.year && last.to.quarter === block.deadline.quarter ? last : null;
}

export function blockCard(page: ComplexPage, block: ComplexBlock): BlockCard {
  const building = block.buildStatus !== "delivered";
  return {
    block,
    status: building ? { kind: "building", pct: block.progressPct } : { kind: "built" },
    // «7 из 12 этажей» — только когда построенные этажи введены: «0 из 12» спорило бы с процентом.
    floors: building && block.floorsTotal && block.floorsBuilt !== null ? { built: block.floorsBuilt, total: block.floorsTotal } : null,
    shift: shiftOf(block),
    cadastre: cadastreOf(block),
    programs: blockPrograms(page, block.id).map((entry) => programLine(entry, page.developer.name)),
    payment: blockPaymentFrom(page.catalog, page.developer.id, block),
  };
}
