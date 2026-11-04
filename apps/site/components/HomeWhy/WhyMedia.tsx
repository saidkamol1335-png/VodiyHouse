"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useMotion } from "@/lib/motion";

/** Кнопка Play тянется за курсором на 16 % смещения (вариант А, «магнит»). */
const PULL = 0.16;

const two = (n: number) => String(n).padStart(2, "0");

/** Таймкод видоискателя: в full идёт по секунде, в lite и none стоит на нуле. */
function Timecode() {
  const tier = useMotion();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (tier !== "full") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [tier]);
  const shown = tier === "full" ? seconds : 0;
  return (
    <span className="home-why__tc">{`00:${two(Math.floor(shown / 60) % 60)}:${two(shown % 60)}`}</span>
  );
}

type WhyMediaProps = { href: string; children: ReactNode };

/**
 * Видоискатель «Видео стройки»: кадры и REC (children), рамка, фокус, полоса, таймкод и Play-«магнит» — ссылка в «Ход строительства»
 * для мыши (с клавиатуры и диктору туда ведёт «Смотреть пример»). Магнит — только full и мышь.
 */
export function WhyMedia({ href, children }: WhyMediaProps) {
  const tier = useMotion();
  const frame = useRef(0);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (tier !== "full" || event.pointerType !== "mouse") return;
    const element = event.currentTarget;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty(
        "--px",
        `${((clientX - rect.left - rect.width / 2) * PULL).toFixed(1)}px`,
      );
      element.style.setProperty(
        "--py",
        `${((clientY - rect.top - rect.height / 2) * PULL).toFixed(1)}px`,
      );
    });
  };
  const leave = (event: PointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(frame.current);
    event.currentTarget.style.setProperty("--px", "0px");
    event.currentTarget.style.setProperty("--py", "0px");
  };
  return (
    <div className="home-why__video" onPointerMove={move} onPointerLeave={leave}>
      {children}
      <span className="home-why__shade" aria-hidden="true" />
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <span key={corner} className={`home-why__vf home-why__vf--${corner}`} aria-hidden="true" />
      ))}
      <span className="home-why__af" aria-hidden="true" />
      <span className="home-why__bar" aria-hidden="true">
        <span className="home-why__bar-fill" />
      </span>
      <span className="home-why__tc-wrap" aria-hidden="true">
        <Timecode />
      </span>
      <Link href={href} className="home-why__play" tabIndex={-1} aria-hidden="true">
        <Play size={24} fill="currentColor" strokeWidth={0} />
      </Link>
    </div>
  );
}
