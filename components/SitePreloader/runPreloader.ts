import { PRELOADER_ATTRIBUTE, PRELOADER_MAX_WAIT_MS } from "@/lib/boot/preloader";
import { getMotionTier } from "@/lib/motion/tier";
import { onHeroLoad } from "@/lib/site/timelapse/heroLoad";

/** Доля шрифтов в процентах; остальное — первый экран. 100 % — только когда пришло всё. */
const FONTS_SHARE = 0.1;
const HERO_SHARE = 0.86;
/** Проценты догоняют загрузку плавно и не быстрее 75 % в секунду — на любой частоте экрана. */
const SMOOTHING_PER_FRAME = 0.88;
const FRAME_MS = 1000 / 60;
const MAX_SHARE_PER_MS = 0.00075;
const LONGEST_FRAME_MS = 100;
const FILLED = 0.998;
/** Уход — как у анимаций в SitePreloader.css: full открывает страницу шторками с 1,4 с. */
const EXIT = {
  full: { className: "site-preloader--leaving-full", openAt: 1400, endAt: 2400 },
  lite: { className: "site-preloader--leaving-lite", openAt: 0, endAt: 220 },
} as const;
/** Сторона янтарного квадрата, в который схлопывается знак, — доля меньшей стороны окна. */
const CORE_SHARE = 0.07;

/** Экран ушёл не сам (переход на другую страницу) — снять метку, иначе та страница не листается. */
let releaseTimer = 0;

/** Проценты, блоки знака и уход экрана. */
class PreloaderRun {
  private readonly count: HTMLElement | null;
  private readonly fill: HTMLElement | null;
  private readonly blocks: Element[];
  /** Страница под экраном: пока он закрывает её, клавиатура и диктор туда не попадают. */
  private readonly page: Element[];
  private fontsReady = false;
  private hero = 0;
  private target = 0;
  private shown = 0;
  private raf = 0;
  private lastFrame = 0;
  private capTimer = 0;
  private openTimer = 0;
  private endTimer = 0;
  private leaving = false;
  private stopped = false;
  private unsubscribe: () => void = () => undefined;

  constructor(private readonly root: HTMLElement) {
    this.count = root.querySelector("[data-preloader-count]");
    this.fill = root.querySelector(".site-preloader__fill");
    this.blocks = Array.from(root.querySelectorAll(".site-preloader__block"));
    this.page = Array.from(root.parentElement?.children ?? []).filter(
      (element) => element !== root && element.tagName !== "SCRIPT",
    );
  }

  start(): void {
    window.clearTimeout(releaseTimer);
    for (const element of this.page) element.setAttribute("inert", "");
    this.unsubscribe = onHeroLoad((share) => {
      this.hero = share;
      this.updateTarget();
    });
    void document.fonts.ready.then(() => {
      if (this.stopped) return;
      this.fontsReady = true;
      this.updateTarget();
    });
    // Время — от начала перехода: столько посетитель уже смотрит на экран.
    const left = Math.max(0, PRELOADER_MAX_WAIT_MS - performance.now());
    this.capTimer = window.setTimeout(this.forceOpen, left);
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe();
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.capTimer);
    window.clearTimeout(this.openTimer);
    window.clearTimeout(this.endTimer);
    this.releasePage();
    // Отложенно: в dev StrictMode эффект запускается заново сразу, и экран должен остаться.
    releaseTimer = window.setTimeout(() => {
      document.documentElement.removeAttribute(PRELOADER_ATTRIBUTE);
    }, 0);
  }

  private releasePage(): void {
    for (const element of this.page) element.removeAttribute("inert");
  }

  private updateTarget(): void {
    const fonts = this.fontsReady ? FONTS_SHARE : 0;
    const next = this.fontsReady && this.hero >= 1 ? 1 : fonts + this.hero * HERO_SHARE;
    this.target = Math.max(this.target, next);
  }

  private readonly tick = (now: number): void => {
    const elapsed = Math.min(now - (this.lastFrame || now), LONGEST_FRAME_MS);
    this.lastFrame = now;
    const eased = (this.target - this.shown) * (1 - SMOOTHING_PER_FRAME ** (elapsed / FRAME_MS));
    this.shown += Math.min(Math.max(eased, 0), MAX_SHARE_PER_MS * elapsed);
    if (this.target >= 1 && this.shown >= FILLED) this.shown = 1;
    this.render();
    if (this.shown >= 1) this.leave();
    else this.raf = requestAnimationFrame(this.tick);
  };

  private readonly forceOpen = (): void => {
    this.shown = 1;
    this.render();
    this.leave();
  };

  private render(): void {
    if (this.count) this.count.textContent = String(Math.round(this.shown * 100)).padStart(3, "0");
    if (this.fill) this.fill.style.transform = `scaleX(${this.shown})`;
    const total = this.blocks.length + 1;
    this.blocks.forEach((block, index) => {
      block.classList.toggle("site-preloader__block--set", this.shown >= (index + 1) / total);
    });
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    cancelAnimationFrame(this.raf);
    const side = Math.min(window.innerWidth, window.innerHeight) * CORE_SHARE;
    this.root.style.setProperty("--preloader-core-x", String(side / window.innerWidth));
    this.root.style.setProperty("--preloader-core-y", String(side / window.innerHeight));
    // Режим — один на весь уход: проба FPS может сменить его посреди анимации.
    const exit = getMotionTier() === "full" ? EXIT.full : EXIT.lite;
    this.root.classList.add(exit.className);
    this.openTimer = window.setTimeout(() => {
      this.root.style.pointerEvents = "none";
      this.releasePage();
    }, exit.openAt);
    this.endTimer = window.setTimeout(() => {
      document.documentElement.removeAttribute(PRELOADER_ATTRIBUTE);
    }, exit.endAt);
  }
}

/** Запускает экран загрузки; возвращает остановку. */
export function runPreloader(root: HTMLElement): () => void {
  const run = new PreloaderRun(root);
  run.start();
  return () => run.stop();
}
