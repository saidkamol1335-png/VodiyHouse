import { stockBadgeView } from "../complexes/stock";
import type { SiteStock, SiteStockComplex, SiteStockError, SiteStockResult } from "./siteStock";

// Что панель «Остатки по ЖК» показывает после каждого чтения (Г4 A). Сбой не стирает цифры: они
// остаются, метка «live» гаснет, рядом — «обновлено N мин назад». Пилюля ЖК, чьё число сменилось,
// вспыхивает, как в мокапе.

export type LiveStock = {
  stock: SiteStock | null;
  live: boolean;
  /** Когда цифры на экране прочитаны (часы браузера, мс); null — неизвестно (чтения не было). */
  readAt: number | null;
  /** Номер вспышки пилюли по ЖК: растёт при смене числа — ключ перезапуска анимации. */
  flashes: Readonly<Record<string, number>>;
};

/** Обрыв связи: Server Action бросил исключение или вернул не ответ. */
export const NETWORK_FAILURE: SiteStockResult = { status: "error", error: "network" };

/** Перечитывать бесполезно: войти заново, нет прав, облака нет. */
const STOP_ERRORS: ReadonlySet<SiteStockError> = new Set(["session", "forbidden", "notConfigured"]);

export type LiveOutcome = "ok" | "retry" | "stop";

export function initialLive(stock: SiteStock | null): LiveStock {
  return { stock, live: stock !== null, readAt: null, flashes: {} };
}

export function isSiteStockResult(value: unknown): value is SiteStockResult {
  return typeof value === "object" && value !== null && "status" in value;
}

export function outcomeOf(result: SiteStockResult): LiveOutcome {
  if (result.status === "done") return "ok";
  return STOP_ERRORS.has(result.error) ? "stop" : "retry";
}

const badgeKey = (complex: SiteStockComplex) => {
  const view = stockBadgeView(complex.stock);
  return `${view.text}:${view.count}`;
};

function flashesAfter(prev: LiveStock, next: SiteStock): Record<string, number> {
  const before = new Map(prev.stock?.complexes.map((complex) => [complex.id, badgeKey(complex)]));
  const flashes = { ...prev.flashes };
  for (const complex of next.complexes) {
    const was = before.get(complex.id);
    if (was !== undefined && was !== badgeKey(complex)) {
      flashes[complex.id] = (flashes[complex.id] ?? 0) + 1;
    }
  }
  return flashes;
}

/**
 * shownAt — когда показаны цифры страницы сервера: при первом же сбое «обновлено N мин назад»
 * считается от него.
 */
export function nextLive(
  prev: LiveStock,
  result: SiteStockResult,
  now: number,
  shownAt: number | null,
): LiveStock {
  if (result.status === "error") return { ...prev, live: false, readAt: prev.readAt ?? shownAt };
  return {
    stock: result.stock,
    live: true,
    readAt: now,
    flashes: flashesAfter(prev, result.stock),
  };
}
