// Правки руководителя (12.5) → что сказать в полосе и нужно ли перечитать список. Успех ложится в
// список из ответа базы (listState), без перечитывания; после отказа перечитываем, только если
// список мог устареть (кто-то удалил квартиру, занял номер или место, ответ не дошёл).

import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { ComplexRequirement } from "../complexes/readiness";
import { reloadsAfter, type StatusSubject } from "./statusOutcome";
import type { UnitErrorField, UnitsActionError } from "./types";

export type EditWhat = "row" | "add" | "price" | "finishing" | "remove" | "removeList";

export type EditMessage =
  | { kind: "rowSaved"; number: string }
  | { kind: "added"; number: string }
  | {
      kind: "priced";
      subject: StatusSubject;
      changed: number;
      withoutLayout: number;
      none: boolean;
    }
  | { kind: "finished"; subject: StatusSubject; changed: number }
  | { kind: "deleted"; count: number }
  /** Квартиру удалили, пока была открыта её правка: правка пропала вместе со строкой. */
  | { kind: "rowGone"; number: string }
  | {
      kind: "editFailed";
      what: EditWhat;
      subject: StatusSubject;
      error: ContentErrorCode;
      broken: ComplexRequirement[];
    };

/** Поле формы для подсветки: номер и место различает код отказа, остальное — detail базы. */
export function fieldOf(error: UnitsActionError): UnitErrorField | null {
  if (error.error === "unitNumberTaken") return "number";
  if (error.error === "unitSlotTaken") return "slot";
  return error.field;
}

// Отказы, на которых список не устарел: правку отклонили по правилу, а не из-за чужих изменений.
// «Весь список» и «5000 квартир» экран проверяет до запроса — если их вернула база, блок поменял
// кто-то ещё, и список перечитывается.
const SAME_LIST: ReadonlySet<ContentErrorCode> = new Set(["confirmName", "notReady"]);

export const reloadsAfterEdit = (error: ContentErrorCode) =>
  reloadsAfter(error) && !SAME_LIST.has(error);

export const editFailed = (
  what: EditWhat,
  subject: StatusSubject,
  error: UnitsActionError,
): EditMessage => ({ kind: "editFailed", what, subject, error: error.error, broken: error.broken });

/** Тон полосы: отказ — ошибка; ничего не поменялось или есть квартиры без планировки — заметка. */
export function editTone(message: EditMessage): "success" | "notice" | "error" {
  if (message.kind === "editFailed" || message.kind === "rowGone") return "error";
  if (message.kind === "priced")
    return message.changed === 0 || message.withoutLayout > 0 ? "notice" : "success";
  if (message.kind === "finished") return message.changed === 0 ? "notice" : "success";
  return "success";
}
