"use client";

import { useEffect, useRef, type RefObject } from "react";
import { frameOfProgress, HERO_ASSETS } from "./stages";
import type { ScrubFrame } from "./types";

type Callbacks = {
  onFrame: (state: ScrubFrame) => void;
  /** Автовоспроизведение не разрешено или формат не поддержан — остаётся постер «Дом сдан». */
  onBlocked: () => void;
};

type Options = Callbacks & {
  /** Только lite: в full лента кадров, в none — постер. */
  enabled: boolean;
  section: RefObject<HTMLElement | null>;
  video: RefObject<HTMLVideoElement | null>;
};

const PHONE_QUERY = "(max-width: 767px)";
/** Пауза после load страницы перед стартом ролика: постер и текст уже на экране, главный поток свободен. */
const START_DELAY_MS = 600;
/** Отказы play(), после которых ролика не будет; AbortError — лишь прерванный pause()/load(). */
const BLOCKED_ERRORS = new Set(["NotAllowedError", "NotSupportedError"]);

/**
 * MP4 без звука в lite: источник по ширине экрана (портрет для телефона); файл не тянется, пока
 * страница не загрузилась (постер — LCP), вне экрана ролик стоит; этап и отметка обновляются по
 * timeupdate (≈ 4 раза в секунду — lite живёт на слабых устройствах, кадр за кадром здесь ни к
 * чему); в конце остаётся последний кадр и повторно не запускается. muted задаёт React (и в
 * разметке, и свойством) — autoplay разрешён.
 */
class HeroPlayer {
  private started = false;
  private detached = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly player: HTMLVideoElement,
    private readonly callbacks: () => Callbacks,
  ) {}

  attach(): void {
    const phone = window.matchMedia(PHONE_QUERY).matches;
    this.player.setAttribute("src", phone ? HERO_ASSETS.videoMobile : HERO_ASSETS.video);
    this.player.addEventListener("timeupdate", this.tick);
    this.player.addEventListener("ended", this.tick);
  }

  /** Экран виден: первый раз — загрузить и запустить, затем — продолжить; после финала — ничего. */
  readonly show = (): void => {
    if (this.detached || this.player.ended) return;
    if (!this.started) {
      this.started = true;
      this.player.setAttribute("preload", "auto");
      this.player.load();
    }
    this.player.play().catch((error: unknown) => {
      const name = typeof error === "object" && error !== null ? (error as { name?: string }).name : undefined;
      if (!this.detached && name && BLOCKED_ERRORS.has(name)) this.callbacks().onBlocked();
    });
  };

  readonly hide = (): void => {
    if (this.started && !this.player.ended) this.player.pause();
  };

  detach(): void {
    this.detached = true;
    this.player.removeEventListener("timeupdate", this.tick);
    this.player.removeEventListener("ended", this.tick);
    this.player.pause();
    this.player.removeAttribute("src");
    this.player.load();
  }

  private readonly tick = (): void => {
    const { currentTime, duration } = this.player;
    if (!duration) return;
    const progress = Math.min(1, currentTime / duration);
    this.host.style.setProperty("--hero-progress", progress.toFixed(3));
    this.callbacks().onFrame({ frame: frameOfProgress(progress), progress });
  };
}

export function useHeroVideo({ enabled, section, video, onFrame, onBlocked }: Options): void {
  const callbacks = useRef<Callbacks>({ onFrame, onBlocked });
  useEffect(() => {
    callbacks.current = { onFrame, onBlocked };
  });

  useEffect(() => {
    const host = section.current;
    const player = video.current;
    if (!enabled || !host || !player) return;
    const hero = new HeroPlayer(host, player, () => callbacks.current);
    hero.attach();
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) hero.show();
      else hero.hide();
    });
    const timer = { id: 0 };
    // Ролик — после load страницы и короткой паузы (наблюдатель тоже подключается после неё: его
    // первый отчёт приходит сразу). Экран наверху запускается и без отчёта — в скрытой вкладке
    // наблюдатель молчит.
    const watch = () => {
      timer.id = window.setTimeout(() => {
        observer.observe(host);
        if (host.getBoundingClientRect().bottom > 0) hero.show();
      }, START_DELAY_MS);
    };
    if (document.readyState === "complete") watch();
    else window.addEventListener("load", watch, { once: true });
    return () => {
      window.removeEventListener("load", watch);
      window.clearTimeout(timer.id);
      observer.disconnect();
      hero.detach();
    };
  }, [enabled, section, video]);
}
