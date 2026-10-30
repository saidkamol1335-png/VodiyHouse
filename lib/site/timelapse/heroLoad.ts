// Связь первого экрана главной и экрана загрузки при входе: лента кадров или ролик сообщают, какая
// доля нужного уже пришла, а сами ждут, пока экран загрузки уйдёт. Доля только растёт: режим может
// смениться с lite на full, проценты назад не идут.

import { PRELOADER_ATTRIBUTE } from "@/lib/boot/preloader";

type Listener = (share: number) => void;

let share = 0;
const listeners = new Set<Listener>();

export function reportHeroLoad(next: number): void {
  const value = Math.min(1, Math.max(share, next));
  if (value === share) return;
  share = value;
  for (const listener of listeners) listener(share);
}

/** Ждать больше нечего: всё пришло, или ролика и ленты не будет. */
export function finishHeroLoad(): void {
  reportHeroLoad(1);
}

/** Подписка: сразу сообщает текущую долю. */
export function onHeroLoad(listener: Listener): () => void {
  listeners.add(listener);
  listener(share);
  return () => listeners.delete(listener);
}

export function isPreloading(doc: Document = document): boolean {
  return doc.documentElement.hasAttribute(PRELOADER_ATTRIBUTE);
}

export function whenPreloaderGone(doc: Document = document): Promise<void> {
  if (!isPreloading(doc)) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (isPreloading(doc)) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: [PRELOADER_ATTRIBUTE],
    });
  });
}
