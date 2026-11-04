/**
 * Один курсор на весь сайт: один пассивный pointermove на документ и один кадр rAF на всех, кто
 * следит за мышью (магнит кнопок, пламя, линзы, превью). В кадре сначала все read (замеры рамок),
 * потом все write (запись переменных и transform) — без чередования чтений и записей. Касания
 * не учитываются: у тач-экрана свои варианты, на pointerdown. Цикл стоит, пока никто не просит кадр.
 */

export type PointerFrame = {
  x: number;
  y: number;
  /** Элемент под курсором; null — курсор ушёл со страницы. */
  target: Element | null;
  /** Время с прошлого кадра, мс (первый кадр после покоя — 16). */
  dt: number;
};

export type PointerSubscriber = {
  read?: (frame: PointerFrame) => void;
  /** true — нужен ещё кадр (догон не закончен). */
  write?: (frame: PointerFrame) => boolean | void;
};

const IDLE_DT = 16;
const subscribers = new Set<PointerSubscriber>();
const state = { x: 0, y: 0, target: null as Element | null };
let frame = 0;
let lastTime = 0;
let listening = false;

function tick(time: number) {
  frame = 0;
  const dt = lastTime ? time - lastTime : IDLE_DT;
  lastTime = time;
  const snapshot: PointerFrame = { ...state, dt };
  for (const subscriber of subscribers) subscriber.read?.(snapshot);
  let again = false;
  for (const subscriber of subscribers) if (subscriber.write?.(snapshot)) again = true;
  if (again) frame = window.requestAnimationFrame(tick);
  else lastTime = 0;
}

/** Попросить кадр (курсор сдвинулся или подписчик запускает догон сам). */
export function requestPointerFrame(): void {
  if (!frame) frame = window.requestAnimationFrame(tick);
}

function onMove(event: PointerEvent) {
  if (event.pointerType === "touch") return;
  state.x = event.clientX;
  state.y = event.clientY;
  state.target = event.target instanceof Element ? event.target : null;
  requestPointerFrame();
}

/** Страница прокрутилась под неподвижным курсором — под ним уже другой элемент. */
function onScroll() {
  if (!state.target) return;
  state.target = document.elementFromPoint(state.x, state.y);
  requestPointerFrame();
}

function onLeave() {
  state.target = null;
  requestPointerFrame();
}

function listen(on: boolean) {
  if (on === listening) return;
  listening = on;
  const method = on ? "addEventListener" : "removeEventListener";
  document[method]("pointermove", onMove as EventListener, { passive: true });
  document.documentElement[method]("pointerleave", onLeave);
  window[method]("scroll", onScroll, { passive: true });
  if (!on && frame) {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
}

/** Подписка на кадры курсора; функция отписки. */
export function subscribePointer(subscriber: PointerSubscriber): () => void {
  subscribers.add(subscriber);
  listen(true);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) listen(false);
  };
}
