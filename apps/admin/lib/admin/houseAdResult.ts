import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { ActionGuardCode } from "@/lib/admin/session";

// Ответ действия «Витрина → Реклама» (lib/admin/actions/houseAd.ts): в файле "use server" экспортируются
// только async-функции (guards.test.ts), поэтому тип — здесь.

export type HouseAdResult =
  | { status: "saved"; enabled: boolean }
  | { status: "error"; error: ContentErrorCode | ActionGuardCode };
