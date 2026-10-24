import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import type { CabinetProgramRecord } from "@/lib/calc/cabinet/records";
import type { Currency, ExchangeRate } from "@/lib/calc/money";
import type { ProgramKind } from "@/lib/calc/programs";
import type { BilingualValue } from "../bilingual";
import type { ContentErrorCode } from "../developers/errors";
import type { PublicationStatus } from "../publication";

// Экран «Программы оплаты» (шаг 2.4, Р2–Р6, В1–В3): данные панелей, курса и ответы действий.

export { PROGRAM_KINDS, type ProgramKind } from "@/lib/calc/programs";

export type ProgramBlockOption = {
  id: string;
  name: string;
  complexId: string;
  complexName: BilingualValue;
  currency: Currency;
};

export type ProgramItem = {
  id: string;
  developerId: string;
  kind: ProgramKind;
  bankName: BilingualValue | null;
  isActive: boolean;
  /** Запись базы целиком — из неё собирается черновик редактора. */
  record: CabinetProgramRecord;
  program: CabinetProgram;
};

export type PriceHint = { perM2: number; currency: Currency };

export type ProgramPanel = {
  id: string;
  slug: string;
  name: string;
  status: PublicationStatus;
  /** «Условия проверены сегодня» (Р5). */
  checkedAt: string | null;
  complexes: number;
  blocks: ProgramBlockOption[];
  programs: ProgramItem[];
  /** Минимальная цена м² свободных квартир — для строки «Пример» (Р8); нет данных — null. */
  priceHint: PriceHint | null;
};

export type RatePart = { usdUzs: number; date: string };

/** Курс (Р6): ЦБ и ручной; действует ручной, если он есть. */
export type RateSetting = { cbu: RatePart | null; manual: RatePart | null };

/** Банк справочника; скрытый не предлагается новым программам, но остаётся у своих. */
export type BankOption = { id: number; name: BilingualValue; isActive: boolean };

export type ProgramsScreenData = {
  panels: ProgramPanel[];
  rate: RateSetting;
  banks: BankOption[];
};

/** Поле черновика с ошибкой: «terms.1.months», «discountPct», «bank»… */
export type ProgramFieldErrors = Record<string, string>;

export type ProgramActionResult<Payload = undefined> =
  | { status: "done"; at: number; payload: Payload }
  | { status: "error"; error: ContentErrorCode | null; fieldErrors: ProgramFieldErrors };

/** Обрыв связи или 5xx: действие пришло исключением — экран показывает «Нет связи» (lib/ui/settle). */
export const NETWORK_FAILURE: ProgramActionResult<never> = {
  status: "error",
  error: "network",
  fieldErrors: {},
};

export type ProgramActions = {
  save: (formData: FormData) => Promise<ProgramActionResult<ProgramItem>>;
  setActive: (formData: FormData) => Promise<ProgramActionResult>;
  remove: (formData: FormData) => Promise<ProgramActionResult>;
  copy: (formData: FormData) => Promise<ProgramActionResult<ProgramItem>>;
  reorder: (formData: FormData) => Promise<ProgramActionResult>;
  markChecked: (formData: FormData) => Promise<ProgramActionResult<string>>;
  setManualRate: (formData: FormData) => Promise<ProgramActionResult<RateSetting>>;
  refreshCbuRate: (formData: FormData) => Promise<ProgramActionResult<RateSetting>>;
};

/** Курс, которым считают: ручной главнее ЦБ. */
export function effectiveRate(rate: RateSetting): ExchangeRate | null {
  if (rate.manual) return { ...rate.manual, source: "manual" };
  if (rate.cbu) return { ...rate.cbu, source: "cbu" };
  return null;
}
