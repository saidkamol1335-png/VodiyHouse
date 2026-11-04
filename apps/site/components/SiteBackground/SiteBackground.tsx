"use client";

import { useEffect, useRef } from "react";
import { useMotion } from "@/lib/motion";
import type { BackgroundRenderer } from "./backgroundRenderer";

/** Пряди плывут медленно: 30 кадров в секунду хватает. */
const FRAME_MS = 33;
/** Кадр без движения (lite, none): пряди на своих местах в этот момент. */
const STILL_SECONDS = 14;

/**
 * Фон сайта — Animated Shader Background (@minhxthanh, 21st.dev) на светлом «тумане долины» (слово
 * исполнителя 04.11): холст на весь экран под содержимым. full — пряди «авроры» плывут; lite и none —
 * один кадр без движения; без WebGL — CSS-градиент под холстом. Код холста — отдельный чанк.
 */
export function SiteBackground() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tier = useMotion();
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    import("./backgroundRenderer")
      .then(({ createBackgroundRenderer }) => {
        const renderer = cancelled ? null : createBackgroundRenderer(surface);
        if (!renderer) return;
        surface.setAttribute("data-live", "");
        stop = tier === "full" ? runLive(surface, renderer) : runStill(renderer);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [tier]);
  return <canvas ref={canvas} className="site-background" aria-hidden="true" />;
}

function runStill(renderer: BackgroundRenderer): () => void {
  const paint = () => {
    renderer.resize();
    renderer.draw(STILL_SECONDS);
  };
  paint();
  window.addEventListener("resize", paint);
  return () => {
    window.removeEventListener("resize", paint);
    renderer.dispose();
  };
}

/** full: ~30 кадров/с по настоящему времени (образец — +0,016 за кадр при 60 к/с); скрытая вкладка — стоп. */
function runLive(surface: HTMLCanvasElement, renderer: BackgroundRenderer): () => void {
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    raf = document.hidden ? 0 : requestAnimationFrame(tick);
    if (now - last < FRAME_MS) return;
    last = now;
    renderer.draw(STILL_SECONDS + now / 1000);
  };
  const wake = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  };
  const resize = () => renderer.resize();
  resize();
  wake();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", wake);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", wake);
    surface.removeAttribute("data-live");
    renderer.dispose();
  };
}
