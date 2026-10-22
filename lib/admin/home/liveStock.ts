import { stockBadgeView } from "../complexes/stock";
import type { SiteStock, SiteStockComplex, SiteStockError, SiteStockResult } from "./siteStock";

// Что панель «Остатки по ЖК» показывает после каждого чтения (Г4 A). Сбой не стирает цифры: они
// остаются, метка «live» гаснет, рядом — «обновлено N мин назад». Пилюля ЖК, чьё число сменилось,
// вспыхивает, как в мокапе. Сессия кончилась, прав нет или кабинет обновили — экран говорит, что
// сделать, а не обещает «попробуем снова».

export type LiveStock = {
  stock: SiteStock | null;
  live: boolean;
  /** Когда прочитаны цифры на экране (часы браузера, мс); null — неизвестно (чтения не было). */
  readAt: number | null;
  /** Номер вспышки пилюли по ЖК: растёт при смене числа — ключ перезапуска анимации. */
  flashes: Readonly<Record<string, number>>;
  /** Почему перечитывание остановлено; null — идёт (или повторится само). */
  halted: HaltReason | null;
};

/** Обрыв связи: Server Action бросил исключение, не ответил вовремя или вернул не ответ. */
export const NETWORK_FAILURE: SiteStockResult = { status: "error", error: "network" };

/** Кабинет обновили: старая страница своё действие уже не найдёт — поможет только перезагрузка. */
export const OUTDATED: SiteStockResult = { status: "error", error: "outdated" };

/** Без нового входа (или прав) читать бесполезно; возврат на вкладку попробует ещё раз. */
const PAUSE_ERRORS = new Set<SiteStockError>(["session", "forbidden", "notConfigured"]);

export type HaltReason = "session" | "forbidden" | "notConfigured" | "outdated";

/** ok и retry — по расписанию; pause — только при возврате на вкладку; stop — больше никогда. */
export type LiveOutcome = "ok" | "retry" | "pause" | "stop";

export function initialLive(stock: SiteStock | null): LiveStock {
  return { stock, live: stock !== null, readAt: null, flashes: {}, halted: null };
}

export function isSiteStockResult(value: unknown): value is SiteStockResult {
  return typeof value === "object" && value !== null && "status" in value;
}

function haltOf(error: SiteStockError): HaltReason | null {
  if (error === "outdated") return "outdated";
  return PAUSE_ERRORS.has(error) ? (error as HaltReason) : null;
}

export function outcomeOf(result: SiteStockResult): LiveOutcome {
  if (result.status === "done") return "ok";
  if (result.error === "outdated") return "stop";
  return PAUSE_ERRORS.has(result.error) ? "pause" : "retry";
}

const badgeKey = (complex: SiteStockComplex) => {
  const view = stockBadgeView(complex.stock, complex.unassigned);
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
  if (result.status === "error") {
    return { ...prev, live: false, readAt: prev.readAt ?? shownAt, halted: haltOf(result.error) };
  }
  return {
    stock: result.stock,
    live: true,
    readAt: now,
    flashes: flashesAfter(prev, result.stock),
    halted: null,
  };
}

/**
 * Activity спрятала главную: при показе CSS перезапустит анимации — гасим вспышки, которые уже
 * были на экране (shown). Новую, пришедшую в том же коммите (вернулись ссылкой — свежие цифры),
 * не трогаем: в разработке StrictMode при показе ещё раз зовёт очистку, и она стёрла бы её.
 */
export function withoutFlashes(
  state: LiveStock,
  shown: Readonly<Record<string, number>>,
): LiveStock {
  const flashes = Object.fromEntries(
    Object.entries(state.flashes).filter(([id, count]) => shown[id] !== count),
  );
  return Object.keys(flashes).length === Object.keys(state.flashes).length
    ? state
    : { ...state, flashes };
}
