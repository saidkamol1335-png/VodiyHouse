"use client";

import type { ReactNode } from "react";
import { useReveal } from "@/lib/motion";

type RevealProps = {
  /** Элемент: блок становится самим раскрывающимся элементом, без лишней обёртки. */
  as?: "div" | "section" | "ul";
  /**
   * rise — блок целиком; words — заголовок по словам (Heading уровня 2 внутри); group — в full движутся
   * сами карточки при прокрутке, в lite группа проявляется целиком.
   */
  variant?: "rise" | "words" | "group";
  className?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
};

/**
 * Появление при прокрутке для серверных блоков: тот же хук сайта, что у разделов страницы ЖК. Только
 * для блоков ниже первого экрана: до оживления страницы они скрыты (без скриптов — видны сразу).
 */
export function Reveal({
  as = "div",
  variant = "rise",
  className,
  children,
  ...rest
}: RevealProps) {
  const reveal = useReveal<HTMLDivElement>();
  const Tag = as as "div";
  const classes = ["reveal", variant === "rise" ? null : `reveal--${variant}`, className];
  return (
    <Tag ref={reveal} className={classes.filter(Boolean).join(" ")} {...rest}>
      {children}
    </Tag>
  );
}
