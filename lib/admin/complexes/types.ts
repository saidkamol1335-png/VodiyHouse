import type { ContentErrorCode } from "../developers/errors";
import type { StatusResult } from "../developers/types";
import type { ComplexCreateErrors, ComplexCreateFields } from "./create";
import type { ComplexMainErrors, ComplexMainFields } from "./mainForm";
import type { ComplexRequirement } from "./readiness";

// Данные страниц «ЖК» и ответы действий — отдельно от "use server" файлов (там только функции).

/** Застройщик в списке выбора: архивных нет — к ним ЖК не добавить. */
export type DeveloperOption = { id: string; name: string };

export type CreateComplexResult =
  | { status: "idle" }
  | {
      status: "error";
      error: ContentErrorCode | null;
      fieldErrors: ComplexCreateErrors;
      fields: ComplexCreateFields;
    };

export type SaveComplexMainResult =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | {
      status: "error";
      error: ContentErrorCode | null;
      fieldErrors: ComplexMainErrors;
      fields: ComplexMainFields;
      /** vh:not_ready у опубликованного: какие условия публикации правка бы нарушила. */
      broken: ComplexRequirement[];
    };

export type ComplexStatusResult = StatusResult<ComplexRequirement>;

/** Превью файла в панели публикации (правило 1.2): фото галереи и чертежи. */
export type ComplexFilePreview = { id: string; src: string; kind: "photo" | "drawing" };

/** Вкладки со строками («Блоки», «Планировки»): ошибки по строке (key) и что нарушила бы правка. */
export type SaveRowsResult =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | {
      status: "error";
      error: ContentErrorCode | null;
      /** Ошибки по строке (key): поле → код из messages вкладки. */
      rowErrors: Record<string, Partial<Record<string, string>>>;
      broken: ComplexRequirement[];
    };

/** Файлы ЖК (фото, чертежи): id — новой строки media_assets или того, что поменяли. */
export type ComplexMediaResult =
  | { status: "done"; id: string }
  | { status: "error"; error: ContentErrorCode; broken: ComplexRequirement[] };
