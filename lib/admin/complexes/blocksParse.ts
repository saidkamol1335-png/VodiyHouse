import { bilingualIssue } from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import { readText } from "../credentials";
import { quarterOf } from "@/lib/quarters";
import {
  BLOCK_LIMITS,
  BUILD_STATUSES,
  CADASTRE_STATUSES,
  CURRENCIES,
  newBlockDraft,
  type BlockDraft,
  type BlockPayload,
  type BlockRowErrors,
  type BlockRowIssue,
  type BlocksParse,
  type CadastreStatus,
  type PriceInclude,
} from "./blocks";

// Вкладка «Блоки» (И4): форма шлёт весь список одним JSON в поле `blocks` — порядок карточек и
// есть порядок на сайте («Блок A», «Блок B»). Сервер проверяет каждую карточку заново.

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

type Whole = { value: number | null; issue?: BlockRowIssue };

function whole(raw: string, min: number, max: number): Whole {
  if (!raw.trim()) return { value: null };
  const value = Number(raw.replace(/\s+/g, ""));
  if (!Number.isInteger(value)) return { value: null, issue: "notWholeNumber" };
  return value < min || value > max ? { value: null, issue: "outOfRange" } : { value };
}

function nameIssue(name: string): BlockRowIssue | undefined {
  if (!name) return "nameRequired";
  return name.length > BLOCK_LIMITS.nameMax ? "nameTooLong" : undefined;
}

function includesIssue(rows: readonly PriceInclude[]): BlockRowIssue | undefined {
  for (const row of rows) {
    const issue = bilingualIssue(row.item, { max: BLOCK_LIMITS.includeItemMax, required: true });
    if (issue) return issue;
    if (bilingualHasContact(row.item)) return "contacts";
  }
  return undefined;
}

/** Карточка → строка для базы или ошибки по полям. */
export function blockPayload(
  row: BlockDraft,
): { payload: BlockPayload } | { issues: BlockRowErrors[string] } {
  const total = whole(row.floorsTotal, 1, BLOCK_LIMITS.floorsMax);
  const built = whole(row.floorsBuilt, 0, BLOCK_LIMITS.floorsMax);
  const progress = whole(row.progressPct, 0, 100);
  const delivered = row.buildStatus === "delivered";
  const issues: BlockRowErrors[string] = {
    name: nameIssue(row.name.trim()),
    floorsTotal: total.issue ?? (total.value === null ? "floorsRequired" : undefined),
    floorsBuilt: delivered
      ? undefined
      : (built.issue ??
        (built.value !== null && total.value !== null && built.value > total.value
          ? "builtOverTotal"
          : undefined)),
    progressPct: delivered ? undefined : progress.issue,
    priceIncludes: includesIssue(row.priceIncludes),
  };
  const found = Object.fromEntries(Object.entries(issues).filter(([, issue]) => issue));
  if (Object.keys(found).length > 0) return { issues: found };
  const deadline = row.deadline ? quarterOf(row.deadline) : null;
  return {
    payload: {
      ...(row.id ? { id: row.id } : {}),
      name: row.name.trim(),
      build_status: row.buildStatus,
      // У сданного блока готовность и «построено» не нужны: сайт пишет «Сдан · 3 кв. 2025».
      progress_pct: delivered ? null : progress.value,
      floors_total: total.value!,
      floors_built: delivered ? null : built.value,
      deadline_year: deadline?.year ?? null,
      deadline_quarter: deadline?.quarter ?? null,
      finishing_id: row.finishingId ? Number(row.finishingId) : null,
      cadastre: row.cadastre || null,
      cadastre_expected_on: row.cadastre === "in_progress" ? row.cadastreExpectedOn : null,
      currency: row.currency,
      price_includes: row.priceIncludes.map((item) => ({
        item: item.item,
        included: item.included,
        ...(item.included || !item.price ? {} : { price: Number(item.price.replace(/\s+/g, "")) }),
      })),
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[\w-]{1,64}$/;
const text = (value: unknown) => (typeof value === "string" ? value : "");

function asInclude(raw: unknown): PriceInclude | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const item = (row.item ?? {}) as Record<string, unknown>;
  if (!KEY.test(text(row.key))) return null;
  return {
    key: text(row.key),
    item: { ru: text(item.ru).trim(), uz: text(item.uz).trim() },
    included: row.included === true,
    price: text(row.price).trim(),
  };
}

function asDraft(raw: unknown): BlockDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.id === null || row.id === undefined ? null : text(row.id);
  const includes = Array.isArray(row.priceIncludes) ? row.priceIncludes.map(asInclude) : [];
  if (!KEY.test(text(row.key)) || (id !== null && !UUID.test(id))) return null;
  if (!oneOf(BUILD_STATUSES, row.buildStatus) || !oneOf(CURRENCIES, row.currency)) return null;
  if (row.cadastre !== "" && !oneOf(CADASTRE_STATUSES, row.cadastre)) return null;
  if (includes.some((item) => item === null) || includes.length > BLOCK_LIMITS.includesMax)
    return null;
  return {
    ...newBlockDraft(),
    key: text(row.key),
    id,
    name: text(row.name),
    buildStatus: row.buildStatus,
    progressPct: text(row.progressPct),
    floorsTotal: text(row.floorsTotal),
    floorsBuilt: text(row.floorsBuilt),
    deadline: text(row.deadline) || null,
    finishingId: /^\d{0,5}$/.test(text(row.finishingId)) ? text(row.finishingId) : "",
    cadastre: row.cadastre as CadastreStatus | "",
    cadastreExpectedOn: text(row.cadastreExpectedOn) || null,
    currency: row.currency,
    priceIncludes: includes as PriceInclude[],
  };
}

/** Разбор поля `blocks`; подделанный или битый JSON — invalid. */
export function parseBlocks(formData: FormData): BlocksParse {
  let raw: unknown;
  try {
    raw = JSON.parse(readText(formData, "blocks") ?? "");
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!Array.isArray(raw)) return { ok: false, error: "invalid" };
  if (raw.length > BLOCK_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  const drafts = raw.map(asDraft);
  if (drafts.some((row) => row === null)) return { ok: false, error: "invalid" };
  const rowErrors: BlockRowErrors = {};
  const payload: BlockPayload[] = [];
  for (const row of drafts as BlockDraft[]) {
    const result = blockPayload(row);
    if ("issues" in result) rowErrors[row.key] = result.issues;
    else payload.push(result.payload);
  }
  if (Object.keys(rowErrors).length > 0) return { ok: false, error: null, rowErrors };
  return { ok: true, payload };
}
