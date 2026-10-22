// Ответ на смену статуса и «Отменить» → что показать в полосе, что записать в список и нужно ли
// перечитать его (12.4). Чистые функции: экран и тесты видят одни правила. Гонка двух сотрудников
// ловится без миграции: прежний статус из ответа базы (undo) сверяется с прочитанным списком.

import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { UnitStatus, UnitsUndo } from "@/lib/units";
import type { RevertUnitsStatusResult, SetUnitsStatusResult } from "./types";

/** Пауза «Отменить» (решение №7) и сколько вкладка должна быть скрыта, чтобы перечитать список. */
export const UNITS_UNDO_MS = 5000;
export const UNITS_RELOAD_AFTER_MS = 10_000;
/** Сколько строк в DOM за раз: до 5000 квартир в блоке, дальше — «Показать ещё». */
export const UNITS_PAGE_SIZE = 200;

/** Номер — у одной квартиры («Кв. 41»), у нескольких — только сколько (массовая смена, 12.5). */
export type StatusSubject = { number: string | null; count: number };

export const statusSubject = (units: readonly { number: string }[]): StatusSubject => ({
  number: units.length === 1 ? units[0]!.number : null,
  count: units.length,
});

export type StatusMessage =
  | { kind: "saving"; subject: StatusSubject; from: UnitStatus | null; to: UnitStatus }
  | { kind: "changed"; subject: StatusSubject; from: UnitStatus | null; to: UnitStatus }
  | { kind: "raced"; subject: StatusSubject; was: UnitStatus | null; to: UnitStatus }
  /** raced — статус поставил кто-то другой (список перечитывается), иначе — наш прежний тап. */
  | { kind: "same"; subject: StatusSubject; to: UnitStatus; raced: boolean }
  | { kind: "failed"; subject: StatusSubject; error: ContentErrorCode }
  | { kind: "reverting"; subject: StatusSubject }
  | { kind: "reverted"; subject: StatusSubject; to: UnitStatus | null }
  | { kind: "revertPartial"; skipped: string[]; missing: number }
  | { kind: "nothing" }
  | { kind: "revertFailed"; subject: StatusSubject; error: ContentErrorCode };

export type StatusOutcome = {
  message: StatusMessage;
  /** Что записать в прочитанный список; null — ничего не сохранилось. */
  applied: Map<string, UnitStatus> | null;
  undo: UnitsUndo | null;
  reload: boolean;
};

// Чтение упадёт с тем же отказом (сессия, права, нет облака) или кривой вход — перечитывать
// незачем. «Нет связи» перечитывает: ответ мог потеряться уже после записи в базу, а если связи
// всё ещё нет, список скажет «не обновился · Повторить».
const NO_RELOAD: ReadonlySet<ContentErrorCode> = new Set([
  "invalid",
  "session",
  "forbidden",
  "notConfigured",
]);

export const reloadsAfter = (error: ContentErrorCode) => !NO_RELOAD.has(error);

/** Один статус на всех или null — у смешанной выборки «было» не одно. */
export function commonStatus(statuses: Iterable<UnitStatus>): UnitStatus | null {
  const unique = new Set(statuses);
  return unique.size === 1 ? [...unique][0]! : null;
}

const failure = (subject: StatusSubject, error: ContentErrorCode): StatusOutcome => ({
  message: { kind: "failed", subject, error },
  applied: null,
  undo: null,
  reload: reloadsAfter(error),
});

/**
 * Ответ set_units_status. confirmed — статусы выбранных квартир по прочитанному списку (без
 * слоя правок) на момент ответа: если база говорит, что было другое, — квартиру поменял кто-то
 * ещё, пока список был открыт.
 */
export function tapOutcome(
  subject: StatusSubject,
  to: UnitStatus,
  confirmed: ReadonlyMap<string, UnitStatus>,
  result: SetUnitsStatusResult,
): StatusOutcome {
  if (result.status === "error") return failure(subject, result.error);
  const was = new Map<string, UnitStatus>();
  for (const group of result.undo) for (const id of group.ids) was.set(id, group.status);
  // Не попала в undo — в базе уже стоял этот статус.
  const raced = [...confirmed].filter(([id, status]) => (was.get(id) ?? to) !== status);
  const applied = new Map([...confirmed.keys()].map((id) => [id, to] as const));
  const undo = result.undo.length > 0 ? result.undo : null;
  if (result.changed === 0) {
    const message = { kind: "same" as const, subject, to, raced: raced.length > 0 };
    return { message, applied, undo: null, reload: raced.length > 0 };
  }
  if (raced.length > 0) {
    const message = { kind: "raced" as const, subject, was: commonStatus(was.values()), to };
    return { message, applied, undo, reload: true };
  }
  const message = { kind: "changed" as const, subject, from: commonStatus(was.values()), to };
  return { message, applied, undo, reload: false };
}

/** Ответ revert_units_status: skipped — номера, что поменяли после тапа; missing — удалённые. */
export function undoOutcome(
  subject: StatusSubject,
  undo: UnitsUndo,
  numbers: ReadonlyMap<string, string>,
  result: RevertUnitsStatusResult,
): StatusOutcome {
  if (result.status === "error") {
    return {
      ...failure(subject, result.error),
      message: { kind: "revertFailed", subject, error: result.error },
    };
  }
  const skipped = new Set(result.skipped);
  const applied = new Map<string, UnitStatus>();
  for (const group of undo)
    for (const id of group.ids)
      if (!skipped.has(numbers.get(id) ?? "")) applied.set(id, group.status);
  if (result.skipped.length > 0 || result.missing > 0) {
    const message = {
      kind: "revertPartial" as const,
      skipped: result.skipped,
      missing: result.missing,
    };
    return { message, applied, undo: null, reload: true };
  }
  // Ничего не вернули, но и не пропустили: в базе уже прежний статус — его поставил кто-то ещё.
  if (result.reverted === 0)
    return { message: { kind: "nothing" }, applied, undo: null, reload: true };
  const to = commonStatus(undo.map((group) => group.status));
  return { message: { kind: "reverted", subject, to }, applied, undo: null, reload: false };
}
