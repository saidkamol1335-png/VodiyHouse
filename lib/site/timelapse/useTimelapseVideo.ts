"use client";

import { useEffect, useRef, type RefObject } from "react";
import { PRELOADER_MAX_WAIT_MS } from "@/lib/boot/preloader";
import { whenMotionDecided } from "@/lib/motion";
import { PHONE_QUERY, timelapseVideoSrc } from "./assets";
import { finishHeroLoad, isPreloading, reportHeroLoad, whenPreloaderGone } from "./heroLoad";

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
/** Раз в столько проверяем, качает ли браузер ролик: iOS без play() не качает, экрану загрузки ждать нечего. */
const LOAD_CHECK_MS = 3000;

export type NetworkHints = { connection?: { saveData?: boolean } };

/**
 * Ролик и лента качаются при любой скорости (решение исполнителя 30.10.2026): на входе их ждёт экран
 * загрузки. Не качаем только при экономии трафика: её посетитель включил сам.
 */
export function skipsVideo(nav: NetworkHints): boolean {
  return nav.connection?.saveData === true;
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
  /** Ролик качается под экраном загрузки: запуск — когда экран уйдёт. */
  private gated = false;
  private stallTimer = 0;
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
      // Под экраном загрузки ждём пробу FPS сколько нужно: иначе зря начнётся ролик, а придёт лента.
      const limit = isPreloading() ? PRELOADER_MAX_WAIT_MS : undefined;
      void whenMotionDecided(limit).then(() => {
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
      if (isPreloading()) this.waitForPreloader();
    }
    if (this.gated) return;
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
    this.stopTracking();
    this.player.removeEventListener("playing", this.playing);
    this.player.removeEventListener("ended", this.ended);
    this.player.removeEventListener("error", this.failed);
    this.phoneQuery?.removeEventListener("change", this.failed);
    this.player.pause();
    this.player.removeAttribute("src");
    this.player.setAttribute("preload", "none");
    this.player.load();
  }

  /** Под экраном загрузки ролик только качается: проценты — по буферу, готов — когда хватит до конца. */
  private waitForPreloader(): void {
    this.gated = true;
    this.player.addEventListener("progress", this.buffered);
    this.player.addEventListener("canplaythrough", this.loaded);
    this.armStall();
    void whenPreloaderGone().then(() => {
      this.gated = false;
      this.stopTracking();
      if (this.wanted) this.show();
    });
  }

  private armStall(): void {
    window.clearTimeout(this.stallTimer);
    this.stallTimer = window.setTimeout(this.checkLoading, LOAD_CHECK_MS);
  }

  private stopTracking(): void {
    window.clearTimeout(this.stallTimer);
    this.player.removeEventListener("progress", this.buffered);
    this.player.removeEventListener("canplaythrough", this.loaded);
  }

  /** Сеть просто медленная — ждём дальше, предел экрана загрузки решит сам; браузер не качает — не ждём. */
  private readonly checkLoading = (): void => {
    if (this.player.networkState === HTMLMediaElement.NETWORK_LOADING) this.armStall();
    else this.loaded();
  };

  private readonly buffered = (): void => {
    const { buffered, duration } = this.player;
    if (buffered.length > 0 && duration > 0) {
      reportHeroLoad(buffered.end(buffered.length - 1) / duration);
    }
  };

  private readonly loaded = (): void => {
    this.stopTracking();
    finishHeroLoad();
  };

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
  // Под экраном загрузки ждать load незачем: постера не видно, а экран ждёт именно этот файл.
  if (isPreloading()) {
    observer.observe(element);
    if (inViewport(element)) clip.show();
    return () => observer.disconnect();
  }
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
