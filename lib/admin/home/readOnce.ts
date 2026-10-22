import { unstable_isUnrecognizedActionError } from "next/navigation";
import { NETWORK_FAILURE, OUTDATED, isSiteStockResult } from "./liveStock";
import type { SiteStockResult } from "./siteStock";

// Одно чтение «live» как ответ, а не исключение. Обрыв связи и 5xx — «нет связи» (как settle);
// ответа нет 20 с (мобильная связь «висит») — тоже, иначе метка горела бы «live» над старыми
// цифрами; кабинет обновили, и старая страница своё действие уже не найдёт, — «обновите страницу».

export const LIVE_READ_DEADLINE_MS = 20_000;

export async function readOnce(read: () => Promise<SiteStockResult>): Promise<SiteStockResult> {
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
