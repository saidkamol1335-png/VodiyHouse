"use client";

import type { CSSProperties } from "react";
import { useMotion } from "@/lib/motion/useMotion";

/**
 * Сумма итога с перекатом разрядов (PLAN §10, п. 49): каждая цифра — лента 0–9, сдвигается к новой
 * (только transform). Разряды считаются справа — «7 558 000» → «12 347 000» катит те же места.
 * full — перекат; lite — число заново проявляется; none — сразу. Ленты и знаки рисует CSS (content):
 * текст узла — одна строка суммы, её читают диктор, копирование и тесты.
 */
export function RollingNumber({ value }: { value: string }) {
  const motion = useMotion();
  const chars = [...value];
  return (
    <span className="rolling-number">
      <span className="sr-only">{value}</span>
      {/* В lite лента не катится: новое число — новый узел, он проявляется. */}
      <span key={motion === "lite" ? value : "reel"} className="rolling-number__track" aria-hidden="true">
        {chars.map((char, index) => {
          const place = chars.length - index;
          if (!/\d/.test(char))
            return (
              <span key={`c${place}${char}`} className="rolling-number__char" data-char={char} />
            );
          return (
            <span key={`d${place}`} className="rolling-number__digit">
              <span className="rolling-number__reel" style={{ "--rolling-digit": char } as CSSProperties} />
            </span>
          );
        })}
      </span>
    </span>
  );
}
