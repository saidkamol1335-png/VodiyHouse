import type { ContentErrorCode } from "../developers/errors";
import type { FormAction } from "../developers/types";
import type { DictionaryItemErrors } from "./definitions";

// Ответы действий «Справочников» — отдельно от "use server" файла.

export type DictionaryActionResult =
  | { status: "idle" }
  | { status: "done"; at: number; outcome?: "deleted" | "hidden" }
  | { status: "error"; error: ContentErrorCode | null; fieldErrors: DictionaryItemErrors };

export type DictionaryActionSet = {
  /** Поля: dictionary, name.ru, name.uz, [second.ru, second.uz], [kind]. */
  add: FormAction<DictionaryActionResult>;
  /** Те же поля и id. */
  update: FormAction<DictionaryActionResult>;
  /** Поля: dictionary, id, active ("true" | "false"). */
  setActive: FormAction<DictionaryActionResult>;
  /** Поля: dictionary, id. Используемое значение база скрывает, а не удаляет. */
  remove: FormAction<DictionaryActionResult>;
  /** Поля: dictionary, order — JSON-массив id. */
  reorder: FormAction<DictionaryActionResult>;
};

export const DICTIONARY_IDLE: DictionaryActionResult = { status: "idle" };
