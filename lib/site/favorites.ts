"use client";

import { useSyncExternalStore } from "react";

// Избранное посетителя (шаг 3.10, Ф7 A): адреса ЖК в браузере — без входа и без сервера. Сердце на
// карточке, счётчик в шапке и /izbrannoe читают одно хранилище; изменение в другой вкладке тоже
// видно (событие storage). Хранилище закрыто (приватный режим) — избранное живёт до закрытия вкладки.

const STORAGE_KEY = "vh.favorites";
const LIMIT = 30;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMPTY: readonly string[] = [];

let memory: readonly string[] | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): readonly string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((slug): slug is string => typeof slug === "string" && SLUG.test(slug)).slice(0, LIMIT) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function read(): readonly string[] {
  if (memory) return memory;
  try {
    memory = parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    memory = EMPTY;
  }
  return memory;
}

function write(next: readonly string[]) {
  memory = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Хранилище закрыто — остаётся память вкладки.
  }
  for (const notify of listeners) notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    memory = parse(event.newValue);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Адреса ЖК в избранном; на сервере и до гидратации — пусто (страницы статичные). */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Сердце: добавить или убрать; новые — в начало, не больше 30. */
export function toggleFavorite(slug: string): void {
  if (!SLUG.test(slug)) return;
  const current = read();
  write(current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current].slice(0, LIMIT));
}

