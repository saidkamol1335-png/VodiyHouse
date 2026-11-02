import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies, draftMode } from "next/headers";
import { supabasePublicEnv } from "./env";

// Предпросмотр ЖК (PLAN §10, фаза C; миграции 20261102190000, 20261102210000): кабинет выдаёт
// грант на 15 минут, сайт проверяет его в базе, хранит токен в cookie и в режиме предпросмотра
// (draftMode, мимо кэша) шлёт его заголовком x-vh-preview — функции сайта видят этот ЖК как
// опубликованный. Сессии сотрудника у сайта нет.

export const PREVIEW_COOKIE = "vh-preview";
export const PREVIEW_MAX_AGE_SECONDS = 15 * 60;
export const PREVIEW_TOKEN = /^[0-9a-f]{48}$/;

/** Клиент роли посетителя с токеном предпросмотра; без токена — как обычный посетитель. */
export function createSupabasePreviewClientFor(token: string | undefined) {
  const { url, publishableKey } = supabasePublicEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: token && PREVIEW_TOKEN.test(token) ? { "x-vh-preview": token } : {} },
  });
}

async function previewToken(): Promise<string | undefined> {
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  return token && PREVIEW_TOKEN.test(token) ? token : undefined;
}

/** Клиент с токеном из cookie предпросмотра. */
export async function createSupabasePreviewClient() {
  return createSupabasePreviewClientFor(await previewToken());
}

/**
 * Идёт ли предпросмотр: draftMode включён и cookie гранта ещё жива. Кука draftMode одна на сборку и
 * живёт до конца сессии браузера — без гранта (истёк, или draftMode включили не мы) страница
 * читается из кэша, как у всех.
 */
export async function isPreview(): Promise<boolean> {
  const { isEnabled } = await draftMode();
  return isEnabled && (await previewToken()) !== undefined;
}

/** slug ЖК из действующего гранта (база проверяет токен) или null. */
export async function grantedSlug(token: string): Promise<string | null> {
  const { data, error } = await createSupabasePreviewClientFor(token).rpc("site_preview_slug");
  if (error) {
    console.error("[preview] грант не проверен", error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}
