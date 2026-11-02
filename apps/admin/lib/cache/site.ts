import "server-only";
import { after } from "next/server";
import { cache } from "react";
import { isRevalidateSecret, REVALIDATE_PATH, SIGNATURE_HEADER, signRevalidate, TIMESTAMP_HEADER } from "@vh/shared/revalidate";
import { siteOrigin } from "@/lib/site/metadata";

// Сброс кэша сайта из кабинета (PLAN §10): сайт — отдельное приложение, его кэш сбрасывает только
// подписанный POST /api/revalidate. Теги копятся за запрос и уходят одним вызовом после ответа
// кабинета (after): сотрудник не ждёт сайт, а сбой сайта не ломает сохранение — кэш сайта всё равно
// истечёт по cacheLife.

export type SiteTags = { now?: string[]; stale?: string[] };

export async function sendSiteRevalidate(tags: SiteTags, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const secret = env.REVALIDATE_SECRET;
  if (!isRevalidateSecret(secret)) {
    console.error("[revalidate] REVALIDATE_SECRET не задан — сайт обновится по истечении кэша");
    return false;
  }
  const body = JSON.stringify({ now: tags.now ?? [], stale: tags.stale ?? [] });
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const response = await fetch(`${siteOrigin(env)}${REVALIDATE_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [TIMESTAMP_HEADER]: String(timestamp),
        [SIGNATURE_HEADER]: signRevalidate(secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) console.error("[revalidate] сайт отказал", response.status, body);
    return response.ok;
  } catch (error) {
    console.error("[revalidate] сайт не ответил", error);
    return false;
  }
}

type Batch = { now: Set<string>; stale: Set<string>; scheduled: boolean };

// Своя пачка у каждого запроса (React cache — на время запроса): теги одновременных действий разных
// сотрудников не перемешиваются. Вне запроса (расписание, скрипты) cache каждый раз даёт новую пачку.
const requestBatch = cache((): Batch => ({ now: new Set(), stale: new Set(), scheduled: false }));

const RETRY_DELAY_MS = 2_000;

async function flush(batch: Batch): Promise<void> {
  // «Сейчас» сильнее «фоном»: один тег в обоих списках — только сейчас.
  const tags = { now: [...batch.now], stale: [...batch.stale].filter((tag) => !batch.now.has(tag)) };
  if (await sendSiteRevalidate(tags)) return;
  // Один повтор: «продана» не должна висеть на сайте до истечения кэша из-за одного сбоя сети.
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  await sendSiteRevalidate(tags);
}

/** Тег — в пачку запроса; первый тег ставит отправку после ответа (вне запроса — сразу). */
export function queueSiteTag(tag: string, kind: "now" | "stale"): void {
  const batch = requestBatch();
  batch[kind].add(tag);
  if (batch.scheduled) return;
  batch.scheduled = true;
  try {
    after(() => flush(batch));
  } catch {
    queueMicrotask(() => void flush(batch));
  }
}
