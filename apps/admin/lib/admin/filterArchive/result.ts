import type { FilterArchive } from "@vh/shared/filterArchive";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { ActionGuardCode } from "@/lib/admin/session";

// Ответ действия «Настройки → Фильтр сайта» (lib/admin/actions/filterArchive.ts): в файле "use server"
// экспортируются только async-функции (guards.test.ts), поэтому типы — здесь.

export type FilterArchiveResult =
  | { status: "saved"; archive: FilterArchive }
  | { status: "error"; error: ContentErrorCode | ActionGuardCode | "busy" };

export type FilterArchiveMode = "archive" | "restore";
