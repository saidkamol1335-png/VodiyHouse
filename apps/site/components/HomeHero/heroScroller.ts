import { HERO_RENDERS } from "@/lib/site/home/heroRenders";
import {
  actFrame,
  driftRise,
  focusScale,
  heroLayout,
  heroPhase,
  LEDGER_OUT_AT,
  OUT_AT,
  SPLIT_AT,
  SKYLINE,
  THROUGH,
  type ActLayer,
  type HeroGeom,
  type HeroPhase,
  type Pose,
} from "@/lib/site/home/heroRise";
import { HERO_LAYERS } from "./heroLayers";
import { HeroWriter } from "./heroWriter";

/** stick — липкая сцена (десктоп ≥ 1024×720); drift — рамки поднимаются, пока экран уезжает; none — ничего. */
export type HeroScrollMode = "stick" | "drift" | "none";

/** Сглаживание по времени (full): прокрутка догоняется за ~80 мс на любой частоте экрана. */
const TAU_MS = 80;
const SETTLED = 0.0005;
/** Дальше этого — прыжок (якорь, «Назад»), а не прокрутка: сразу на месте. */
const JUMP = 0.25;

const px = (value: string) => Number.parseFloat(value) || 0;

/**
 * Прокрутка первого экрана: доля пути из scrollY и измеренных раз на размер окна начала и длины трека
 * (без чтения раскладки в кадре), в full — с мягким догоном по времени. Каждый кадр — позы слоёв из
 * actFrame прямо в transform и opacity листьев (HeroWriter пишет только изменившееся); на секции
 * в сцене ничего не переключается — браузер не пересчитывает стили всего экрана.
 */
export class HeroScroller {
  private current = -1;
  private raf = 0;
  private last = 0;
  private dirty = true;
  private destroyed = false;
  private isReady = false;
  private size = { w: 0, h: 0 };
  private trackTop = 0;
  private length = 1;
  private settle = 0;
  private geom: HeroGeom | null = null;
  private phase: HeroPhase | null = null;
  private through = false;
  /** drift: верх ряда рамок и высота каждой рамки. */
  private rowTop = 0;
  private readonly heights = new Map<HTMLElement, number>();
  private readonly layers = new Map<ActLayer, HTMLElement>();
  private readonly writer = new HeroWriter();
  private readonly shifts = new Map<HTMLElement, HTMLElement[]>();
  private readonly copy: HTMLElement | null;
  private readonly stage: HTMLElement | null;

  constructor(
    private readonly host: HTMLElement,
    private readonly mode: Exclude<HeroScrollMode, "none">,
    private readonly smooth: boolean,
  ) {
    for (const [layer, selector] of Object.entries(HERO_LAYERS) as [ActLayer, string][]) {
      const element = host.querySelector<HTMLElement>(selector);
      if (element) this.layers.set(layer, element);
    }
    this.copy = host.querySelector<HTMLElement>(".home-hero__copy");
    this.stage = host.querySelector<HTMLElement>(".home-hero__stage");
  }

  readonly schedule = (): void => {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(this.update);
  };

  readonly resize = (): void => {
    // Телефон: панель браузера, скрываясь, меняет только высоту окна — раскладку ряда это не трогает.
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const toolbar =
      this.mode === "drift" && width === this.size.w && Math.abs(height - this.size.h) < 120;
    this.size = { w: width, h: height };
    if (toolbar) return;
    this.dirty = true;
    this.schedule();
  };

  /**
   * Сцена поставила первую позу: до этого, если страница открыта не сверху (якорь, перезагрузка,
   * «Назад»), CSS прячет её (html[data-reveal-off] без data-hero-ready) — каталог не закрыт.
   */
  private ready(): void {
    if (this.isReady) return;
    this.isReady = true;
    document.documentElement.setAttribute("data-hero-ready", "");
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.writer.reset();
    this.host.removeAttribute("data-phase");
    document.documentElement.removeAttribute("data-hero-ready");
  }

  /** Конец сцены (под пластинами — каталог): туда ведёт фокус, ушедший за первый экран. */
  get end(): number {
    return this.trackTop + this.length;
  }

  get start(): number {
    return this.trackTop;
  }

  get progress(): number {
    return this.current;
  }

  /** Сразу на место (фокус, прыжок): без догона. */
  jump(top: number): void {
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    this.current = -1;
    this.update(performance.now());
  }

  readonly update = (now: number = performance.now()): void => {
    this.raf = 0;
    if (this.destroyed) return;
    if (this.dirty) this.measure();
    const goal = this.goal();
    const dt = Math.min(50, Math.max(0, now - this.last));
    this.last = now;
    const stuck = window.scrollY >= this.trackTop && window.scrollY <= this.end;
    const snap =
      !this.smooth ||
      this.current < 0 ||
      Math.abs(goal - this.current) > JUMP ||
      goal <= 0 ||
      goal >= THROUGH.on ||
      !stuck;
    this.current = snap
      ? goal
      : this.current + (goal - this.current) * (1 - Math.exp(-dt / TAU_MS));
    if (Math.abs(goal - this.current) < SETTLED) this.current = goal;
    if (this.mode === "stick") this.applyStick(this.current);
    else this.applyDrift(this.current);
    if (this.current !== goal) this.raf = requestAnimationFrame(this.update);
  };

  private goal(): number {
    return Math.min(1, Math.max(0, (window.scrollY - this.trackTop) / this.length));
  }

  private measure(): void {
    this.dirty = false;
    if (this.mode === "drift") return this.measureDrift();
    const track = this.host.querySelector<HTMLElement>(".home-hero__track");
    const { stage, copy } = this;
    const title = this.layers.get("title");
    const ledger = this.layers.get("ledger");
    const perks = this.layers.get("perks");
    const facts = this.host.querySelector<HTMLElement>(".home-hero__facts-row");
    if (!track || !stage || !copy || !title || !ledger || !perks) return;
    this.trackTop = this.host.getBoundingClientRect().top + window.scrollY;
    this.length = Math.max(1, track.offsetHeight - stage.offsetHeight);
    const perksBottom = perks.offsetTop + perks.offsetHeight;
    this.settle = perks.offsetHeight + (facts ? facts.offsetTop - perksBottom : 0);
    const center = HERO_RENDERS[0]!;
    this.geom = heroLayout({
      vw: document.documentElement.clientWidth,
      vh: window.innerHeight,
      header: px(getComputedStyle(document.documentElement).getPropertyValue("--header-h")),
      titleTop: copy.offsetTop + title.offsetTop,
      titleH: title.offsetHeight,
      horizon: ledger.offsetTop,
      settle: this.settle,
      centerRatio: center.width / center.height,
    });
    this.writeLayout(this.geom);
  }

  /** Размеры рамок и пластин — раз на размер окна; в кадре — только transform и opacity. */
  private writeLayout(geom: HeroGeom): void {
    for (const tower of SKYLINE) {
      const element = this.layers.get(tower.slot);
      if (!element) continue;
      if (tower.slot === "c") {
        const { left, top, w, h } = geom.center;
        this.writer.box(element, { left, top, width: w, height: h });
        for (const shift of element.querySelectorAll<HTMLElement>(".home-hero__shift"))
          this.writer.box(shift, { height: h });
        continue;
      }
      const box = geom.towers[tower.slot];
      if (box)
        this.writer.box(element, {
          display: "block",
          left: box.left,
          top: box.top,
          width: box.w,
          height: geom.height,
        });
      else this.writer.box(element, { display: "none" });
    }
    const top = this.layers.get("plate-top");
    const bottom = this.layers.get("plate-bottom");
    if (top) this.writer.box(top, { top: 0, height: geom.seam + 1 });
    if (bottom) this.writer.box(bottom, { top: geom.seam, height: geom.vh - geom.seam + 40 });
  }

  private measureDrift(): void {
    const row = this.host.querySelector<HTMLElement>(".home-hero__skyline");
    if (!row) return;
    // Подъём — когда ряд проходит 60 % окна, но не раньше первой прокрутки: при входе рамок не видно.
    const rowTop = row.getBoundingClientRect().top + window.scrollY;
    const height = document.documentElement.clientHeight;
    this.trackTop = Math.max(0, rowTop - 0.6 * height);
    this.length = Math.max(1, 0.5 * height);
    this.heights.clear();
    for (const tower of SKYLINE) {
      const element = this.layers.get(tower.slot);
      if (element) this.heights.set(element, element.offsetHeight + 80);
    }
  }

  private applyStick(p: number): void {
    if (!this.geom) return;
    const poses = actFrame(p, this.geom, this.settle);
    for (const [layer, element] of this.layers) {
      // У ореола своё центрирование (transform в CSS) — ему только прозрачность.
      if (layer === "glow") this.writer.style(element, "opacity", poses.glow.o.toFixed(3));
      else this.writer.pose(element, poses[layer] as Pose);
    }
    if (this.smooth) this.applyFocus(p);
    this.through = this.through ? p >= THROUGH.off : p >= THROUGH.on;
    const ledger = this.layers.get("ledger");
    if (this.copy) this.writer.style(this.copy, "pointerEvents", p > OUT_AT ? "none" : "");
    if (ledger) this.writer.style(ledger, "pointerEvents", p > LEDGER_OUT_AT ? "none" : "");
    if (this.stage) {
      // Пластины и половины кнопок не несут: с раскола клики уходят каталогу в щели.
      this.writer.style(this.stage, "pointerEvents", p >= SPLIT_AT ? "none" : "");
      this.writer.style(this.stage, "visibility", this.through ? "hidden" : "");
    }
    this.ready();
    this.mark(heroPhase(p));
  }

  /** full: картинки в рамках «фокусируются» на подъёме (motion kit 07). */
  private applyFocus(p: number): void {
    for (const tower of SKYLINE) {
      const element = this.layers.get(tower.slot);
      if (!element) continue;
      const pose = { tx: 0, ty: 0, s: focusScale(p, tower.rank), o: 1 };
      let shifts = this.shifts.get(element);
      if (!shifts) {
        shifts = [...element.querySelectorAll<HTMLElement>(".home-hero__shift")];
        this.shifts.set(element, shifts);
      }
      for (const shift of shifts) this.writer.pose(shift, pose);
    }
  }

  private applyDrift(d: number): void {
    for (const tower of SKYLINE) {
      const element = this.layers.get(tower.slot);
      if (!element) continue;
      const rise = (this.heights.get(element) ?? 0) * driftRise(d, tower.rank);
      this.writer.pose(element, { tx: 0, ty: rise, s: 1, o: 1 });
    }
    this.mark(d >= 1 ? "hold" : d > 0 ? "rise" : "rest");
  }

  /** Метка для e2e: ни один селектор CSS на неё не смотрит — пересчёта стилей нет. */
  private mark(phase: HeroPhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.host.setAttribute("data-phase", phase);
  }
}
