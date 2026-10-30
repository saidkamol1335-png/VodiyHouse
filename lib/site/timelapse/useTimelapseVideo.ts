"use client";

import { useEffect, useRef, type RefObject } from "react";
import { whenMotionDecided } from "@/lib/motion";
import { PHONE_QUERY, timelapseVideoSrc } from "./assets";

type Callbacks = {
  /** Пошёл первый кадр — ролик проявляется поверх постера. */
  onPlaying: () => void;
  /** Ролик доиграл или уже играл в этом показе страницы — дальше постер: тот же последний кадр. */
  onEnded: () => void;
  /**
   * Ролика не будет: автовоспроизведение запрещено, файл или сеть подвели (и посреди ролика), экономия
   * трафика, повернули телефон (ролик другой ориентации) — остаётся постер.
   */
  onBlocked: () => void;
};

type Options = Callbacks & {
  /** full и lite; в none ролика нет. */
  enabled: boolean;
  /** Блок ролика: виден — ролик идёт, ушёл с экрана — стоит. */
  host: RefObject<HTMLElement | null>;
  video: RefObject<HTMLVideoElement | null>;
  /** На телефоне — вырезка 9:16 (первый экран главной); панели и карточки берут 16:9. */
  portraitOnPhone: boolean;
};

/** Пауза и продолжение кнопкой (WCAG 2.2.2): остановленный ролик сам, по прокрутке, не продолжится. */
export type TimelapseControl = { pause: () => void; resume: () => void };

/** Пауза после load страницы перед стартом ролика: постер и текст уже на экране, главный поток свободен. */
const START_DELAY_MS = 600;
/** Отказы play(), после которых ролика не будет; AbortError — лишь прерванный pause()/load(). */
const BLOCKED_ERRORS = new Set(["NotAllowedError", "NotSupportedError"]);
/** Медленная сеть: ролик в 2–7 МБ не догонит показ, остаётся постер. */
const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

export type NetworkHints = { connection?: { saveData?: boolean; effectiveType?: string } };

/** Экономия трафика или медленная сеть — ролик не качаем. */
export function skipsVideo(nav: NetworkHints): boolean {
  const connection = nav.connection;
  return connection?.saveData === true || SLOW_CONNECTIONS.has(connection?.effectiveType ?? "");
}

/** Блок сейчас на экране (и вообще показан: у display: none размеры нулевые). */
function inViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

/**
 * Ролик без звука в full и lite: источник по ширине экрана и формату; файл не тянется, пока страница
 * не загрузилась (постер первым) и не решён режим; вне экрана ролик стоит; играет один раз и
 * отдаёт место постеру. muted задаёт React (и в разметке, и свойством) — autoplay разрешён.
 */
class TimelapsePlayer {
  private started = false;
  private detached = false;
  private ready = false;
  /** Блок сейчас виден — после решения режима запускать, только если всё ещё виден. */
  private wanted = false;
  /** Остановлен кнопкой — наблюдатель его не продолжает. */
  private held = false;
  private phoneQuery: MediaQueryList | null = null;

  constructor(
    private readonly player: HTMLVideoElement,
    private readonly callbacks: () => Callbacks,
  ) {}

  get hasStarted(): boolean {
    return this.started;
  }

  attach(portraitOnPhone: boolean): void {
    this.phoneQuery = portraitOnPhone ? window.matchMedia(PHONE_QUERY) : null;
    const webm = this.player.canPlayType('video/webm; codecs="vp9"') !== "";
    this.player.setAttribute(
      "src",
      timelapseVideoSrc({ phone: this.phoneQuery?.matches ?? false, webm }),
    );
    this.player.addEventListener("playing", this.playing);
    this.player.addEventListener("ended", this.ended);
    this.player.addEventListener("error", this.failed);
    this.phoneQuery?.addEventListener("change", this.failed);
  }

  /** Блок виден: первый раз — загрузить и запустить, затем — продолжить; после финала — ничего. */
  readonly show = (): void => {
    this.wanted = true;
    if (this.detached || this.held || this.player.ended) return;
    // Первый запуск — когда режим решён: решат none — этот плеер отцепят, ролик не скачается.
    if (!this.started && !this.ready) {
      void whenMotionDecided().then(() => {
        this.ready = true;
        if (this.wanted) this.show();
      });
      return;
    }
    if (!this.started) {
      if (skipsVideo(navigator as NetworkHints)) return this.failed();
      this.started = true;
      this.player.setAttribute("preload", "auto");
      this.player.load();
    }
    this.player.play().catch((error: unknown) => {
      const name =
        typeof error === "object" && error !== null ? (error as { name?: string }).name : undefined;
      if (name && BLOCKED_ERRORS.has(name)) this.failed();
    });
  };

  readonly hide = (): void => {
    this.wanted = false;
    if (this.started && !this.player.ended) this.player.pause();
  };

  pause(): void {
    this.held = true;
    if (this.started) this.player.pause();
  }

  resume(): void {
    this.held = false;
    if (this.wanted) this.show();
  }

  detach(): void {
    this.detached = true;
    this.player.removeEventListener("playing", this.playing);
    this.player.removeEventListener("ended", this.ended);
    this.player.removeEventListener("error", this.failed);
    this.phoneQuery?.removeEventListener("change", this.failed);
    this.player.pause();
    this.player.removeAttribute("src");
    this.player.setAttribute("preload", "none");
    this.player.load();
  }

  private readonly playing = (): void => this.callbacks().onPlaying();
  private readonly ended = (): void => this.callbacks().onEnded();
  private readonly failed = (): void => {
    if (!this.detached) this.callbacks().onBlocked();
  };
}

/**
 * Ролик в блоке host. Возвращает пульт паузы для кнопки. Ролик играет один раз за показ страницы: Next
 * держит ушедшую страницу в скрытом Activity, при возврате «Назад» эффекты запускаются заново, а
 * состояние живо — уже начатый ролик второй раз не идёт, сразу постер (тот же последний кадр).
 */
export function useTimelapseVideo({
  enabled,
  host,
  video,
  portraitOnPhone,
  onPlaying,
  onEnded,
  onBlocked,
}: Options) {
  const callbacks = useRef<Callbacks>({ onPlaying, onEnded, onBlocked });
  const control = useRef<TimelapseControl | null>(null);
  const played = useRef(false);
  useEffect(() => {
    callbacks.current = { onPlaying, onEnded, onBlocked };
  });

  useEffect(() => {
    const element = host.current;
    const player = video.current;
    if (!enabled || !element || !player) return;
    if (played.current) return callbacks.current.onEnded();
    const clip = new TimelapsePlayer(player, () => callbacks.current);
    clip.attach(portraitOnPhone);
    control.current = { pause: () => clip.pause(), resume: () => clip.resume() };
    const stopWatching = watchVisibility(element, clip);
    return () => {
      played.current ||= clip.hasStarted;
      control.current = null;
      stopWatching();
      clip.detach();
    };
  }, [enabled, host, video, portraitOnPhone]);
  return control;
}

/**
 * Ролик — после load страницы и короткой паузы (наблюдатель тоже подключается после неё: его первый
 * отчёт приходит сразу). Блок на экране запускается и без отчёта — в скрытой вкладке наблюдатель молчит.
 */
function watchVisibility(element: HTMLElement, clip: TimelapsePlayer): () => void {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) clip.show();
    else clip.hide();
  });
  const timer = { id: 0 };
  const watch = () => {
    timer.id = window.setTimeout(() => {
      observer.observe(element);
      if (inViewport(element)) clip.show();
    }, START_DELAY_MS);
  };
  if (document.readyState === "complete") watch();
  else window.addEventListener("load", watch, { once: true });
  return () => {
    window.removeEventListener("load", watch);
    window.clearTimeout(timer.id);
    observer.disconnect();
  };
}
