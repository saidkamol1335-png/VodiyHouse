"use client";

import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  storageErrorCode,
  type ContentErrorCode,
  type StorageErrorLike,
} from "./developers/errors";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

// Отказы при загрузке файла из браузера в Storage — общие для фото и чертежей ЖК и для логотипа
// и фона застройщика.

/** Отказ сервера или Storage: код для messages (admin.developers.errors), в бакете файла нет. */
export class UploadRefused extends Error {
  constructor(readonly code: ContentErrorCode) {
    super(`upload-${code}`);
  }
}

/**
 * Отказ Storage → UploadRefused с кодом; сбой сети — обычная ошибка («проверьте связь»).
 * Сессия, потерянная в браузере (выход в другой вкладке, токен не обновился), уходит в Storage
 * публичным ключом и получает отказ политики — «нет доступа» руководителю было бы неправдой.
 */
export async function refuseUpload(
  supabase: BrowserClient,
  error: StorageErrorLike,
): Promise<never> {
  // Причина видна хотя бы в консоли: политика, сессия или бакет в облаке.
  console.warn("Storage отказал в загрузке", error.statusCode, error.message);
  const code = storageErrorCode(error);
  if (code === "network") throw new Error("upload-network", { cause: error });
  if (code !== "session" && !(await supabase.auth.getSession()).data.session) {
    throw new UploadRefused("session");
  }
  throw new UploadRefused(code);
}
