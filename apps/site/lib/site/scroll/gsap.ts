"use client";

import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

export type GsapKit = { gsap: typeof Gsap; ScrollTrigger: typeof ScrollTriggerType };

let pending: Promise<GsapKit> | null = null;

/**
 * GSAP и ScrollTrigger (PLAN §10, п. 47) — отдельным чанком и только когда блок в режиме full их
 * попросил: lite и none их не грузят. Плагин регистрируется один раз; прокрутку сайта не перехватываем
 * (без Lenis и normalizeScroll), высоту при скрытии панели браузера на телефоне не пересчитываем.
 * Чанк не загрузился (сеть) — кэш сбрасывается: следующий блок попробует снова.
 */
export function loadGsap(): Promise<GsapKit> {
  pending ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
    .then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });
      const kit = { gsap, ScrollTrigger };
      watchPageHeight(kit);
      return kit;
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

function refreshInOrder({ ScrollTrigger }: GsapKit): void {
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

/**
 * Высота страницы поменялась не от окна (каталог выше «Показать ещё», фото без размеров): позиции pin
 * ниже устарели — пересчёт с задержкой. Свои же отступы pin после пересчёта не считаются изменением.
 */
function watchPageHeight(kit: GsapKit): void {
  let height = document.body.scrollHeight;
  let timer = 0;
  const observer = new ResizeObserver(() => {
    if (Math.abs(document.body.scrollHeight - height) < 2) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      refreshInOrder(kit);
      height = document.body.scrollHeight;
    }, 200);
  });
  observer.observe(document.body);
  kit.ScrollTrigger.addEventListener("refresh", () => {
    height = document.body.scrollHeight;
  });
}

/**
 * Пересчитать позиции, когда встали шрифты и первые картинки блока: иначе pin считает по заглушкам.
 * На главной два pin («Выберите свою квартиру» и «Проекты»), а GSAP грузится асинхронно — триггеры
 * создаются не по порядку страницы: sort() ставит их по положению, чтобы отступ верхнего pin учёлся.
 */
export function refreshWhenSettled(kit: GsapKit, root: Element, images = 2): void {
  kit.ScrollTrigger.sort();
  const firstImages = [...root.querySelectorAll("img")].slice(0, images);
  const loaded = firstImages.map((image) =>
    image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
  );
  void Promise.all([document.fonts?.ready, ...loaded]).then(() => refreshInOrder(kit));
}

/**
 * Блок с pin появился, когда посетитель уже ниже него (режим full включился после загрузки, «Назад»):
 * отступ pin вырос над окном — страница сдвигается на ту же разницу, видимое место не уезжает.
 */
export function keepPlaceAbove(kit: GsapKit, block: Element, create: () => void): void {
  const above = block.getBoundingClientRect().bottom < 0;
  const before = document.documentElement.scrollHeight;
  create();
  if (!above) return;
  refreshInOrder(kit);
  const delta = document.documentElement.scrollHeight - before;
  if (delta !== 0) window.scrollBy({ top: delta, behavior: "instant" });
}
