import { unstable_isUnrecognizedActionError } from "next/navigation";
import { NETWORK_FAILURE, OUTDATED, isSiteStockResult } from "./liveStock";
import type { SiteStockResult } from "./siteStock";

// Одно чтение «live» как ответ, а не исключение. Обрыв связи и 5xx — «нет связи» (как settle);
// ответа нет 20 с (мобильная связь «висит») — тоже, иначе метка горела бы «live» над старыми
// цифрами; кабинет обновили, и старая страница своё действие уже не найдёт, — «обновите страницу».

export const LIVE_READ_DEADLINE_MS = 20_000;

type Read = () => Promise<SiteStockResult>;

export async function readOnce(read: Read): Promise<SiteStockResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<SiteStockResult>((resolve) => {
    timer = setTimeout(() => resolve(NETWORK_FAILURE), LIVE_READ_DEADLINE_MS);
  });
  try {
    const answer: unknown = await Promise.race([read(), deadline]);
    return isSiteStockResult(answer) ? answer : NETWORK_FAILURE;
  } catch (error) {
    return unstable_isUnrecognizedActionError(error) ? OUTDATED : NETWORK_FAILURE;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Чтения без наслоения. Server Action не отменить, а в Next они идут одной очередью: пока
 * зависшее чтение не вернулось, новое встало бы за ним — и с ним сохранения в других разделах.
 * Поэтому, пока прошлое не вернулось, новое не шлём и сразу отвечаем «нет связи».
 */
export function createLiveRead() {
  let pending: Promise<SiteStockResult> | null = null;
  return (read: Read): Promise<SiteStockResult> => {
    if (pending) return Promise.resolve(NETWORK_FAILURE);
    let call: Promise<SiteStockResult>;
    try {
      call = read();
    } catch (error) {
      call = Promise.reject(error);
    }
    pending = call;
    const release = () => {
      if (pending === call) pending = null;
    };
    call.then(release, release);
    return readOnce(() => call);
  };
}
