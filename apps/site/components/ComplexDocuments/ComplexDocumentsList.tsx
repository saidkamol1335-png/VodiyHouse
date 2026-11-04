"use client";

import { ArrowRight } from "lucide-react";
import { type CSSProperties, type PointerEvent, type RefObject, useEffect, useRef } from "react";
import { useLeadOpener } from "@/components/LeadDialog";
import { TermHint } from "@/components/TermHint";
import { aimSpring, createSpring, getMotionTier, type Spring, stepSpring, useFinePointer } from "@/lib/motion";
import { type DocumentImageKey, documentImageSrc, documentImageSrcSet } from "@/lib/site/complex/documentImages";

export type DocumentRow = {
  slug: string;
  name: string;
  hintLabel: string;
  hint: string | null;
  date: string;
  image: DocumentImageKey;
  /** «Запросить скан: Право на землю» — имя строки-кнопки. */
  requestLabel: string;
};

type ListProps = { rows: readonly DocumentRow[]; complexSlug: string; complexName: string };

/**
 * «Документы ЖК» (мокап .li, ТЗ 7.8) — Interactive Hover Links (@hurerag24) один в один (04.11.2026):
 * крупные строки, под мышью рамка и текст темнеют, слово уходит влево, а буквы волной возвращаются;
 * под текстом всплывает фото (иллюстрация, не скан) с поворотом и ходит за курсором; справа выезжает
 * стрелка. Пружины — как у framer-motion по умолчанию (lib/motion/spring). Нажатие на строку —
 * заявка на скан этого документа (сканы выдаёт менеджер).
 */
export function ComplexDocumentsList({ rows, complexSlug, complexName }: ListProps) {
  const open = useLeadOpener();
  return (
    <ul className="complex-documents">
      {rows.map((row) => (
        <DocumentLink
          key={row.slug}
          row={row}
          onRequest={(origin) => open?.({ type: "documents", object: { complex: complexSlug }, context: `${complexName} · ${row.name}` }, origin)}
        />
      ))}
    </ul>
  );
}

function DocumentLink({ row, onRequest }: { row: DocumentRow; onRequest: (origin: HTMLElement) => void }) {
  const item = useRef<HTMLLIElement>(null);
  const fine = useFinePointer();
  const hover = useHoverSprings(item, row.name.length, fine);
  return (
    <li ref={item} className="complex-documents__item" onPointerEnter={hover.enter} onPointerMove={hover.move} onPointerLeave={hover.leave}>
      <button type="button" className="complex-documents__hit" aria-label={row.requestLabel} onClick={(event) => onRequest(event.currentTarget)} />
      <div className="complex-documents__text">
        <span className="complex-documents__heading">
          <span className="sr-only">{row.name}</span>
          <span className="complex-documents__word" aria-hidden="true">
            {[...row.name].map((letter, index) => (
              <span key={index} className="complex-documents__letter" style={{ "--i": index } as CSSProperties}>
                {letter === " " ? " " : letter}
              </span>
            ))}
          </span>
          {row.hint ? <TermHint label={row.hintLabel} text={row.hint} /> : null}
        </span>
        <span className="complex-documents__sub">{row.date}</span>
      </div>
      <picture className="complex-documents__shot">
        <source type="image/avif" srcSet={documentImageSrcSet(row.image, "avif")} sizes="(min-width: 768px) 208px, 128px" />
        <source type="image/webp" srcSet={documentImageSrcSet(row.image, "webp")} sizes="(min-width: 768px) 208px, 128px" />
        <img src={documentImageSrc(row.image)} alt="" loading="lazy" decoding="async" />
      </picture>
      <div className="complex-documents__arrow-clip" aria-hidden="true">
        <div className="complex-documents__arrow">
          <ArrowRight />
        </div>
      </div>
    </li>
  );
}

type Rig = {
  word: Spring;
  letters: Spring[];
  scale: Spring;
  rotate: Spring;
  arrowX: Spring;
  arrowOpacity: Spring;
  mx: Spring;
  my: Spring;
  /** Левый край фото от начала строки, px: сразу за названием (считается при наведении). */
  anchor: number;
};

/** Значения образца: слово −16 px, буквы +16 px (задержка 0,25 с, шаг 0,075 с), фото 0 → 1 и −12,5° → 12,5°. */
const WORD_SHIFT = 16;
const CHILD_DELAY_MS = 250;
const CHILD_STAGGER_MS = 75;

function createRig(letters: number): Rig {
  return {
    word: createSpring(0),
    letters: Array.from({ length: letters }, () => createSpring(0)),
    scale: createSpring(0, "unit"),
    rotate: createSpring(-12.5, "unit"),
    arrowX: createSpring(100, "unit"),
    arrowOpacity: createSpring(0, "unit"),
    mx: createSpring(0, "unit"),
    my: createSpring(0, "unit"),
    anchor: 0,
  };
}

/** Зазор между концом названия и фото; справа — место под стрелку. */
const SHOT_GAP = 28;
const ARROW_ROOM = 64;

/**
 * Фото выходит рядом с названием, а не поверх него (слово исполнителя 04.11; в образце — от середины
 * строки): левый край — сразу за названием и «?»; длинное название — фото прижато к стрелке.
 */
function measureAnchor(host: HTMLElement): number {
  const heading = host.querySelector(".complex-documents__heading");
  const shot = host.querySelector<HTMLElement>(".complex-documents__shot");
  if (!heading || !shot) return 0;
  const end = heading.getBoundingClientRect().right - host.getBoundingClientRect().left + SHOT_GAP;
  return Math.max(0, Math.min(end, host.offsetWidth - shot.offsetWidth - ARROW_ROOM));
}

function aimRig(rig: Rig, on: boolean, now: number) {
  aimSpring(rig.word, on ? -WORD_SHIFT : 0, now);
  rig.letters.forEach((letter, index) => aimSpring(letter, on ? WORD_SHIFT : 0, now, CHILD_DELAY_MS + index * CHILD_STAGGER_MS));
  aimSpring(rig.scale, on ? 1 : 0, now);
  aimSpring(rig.rotate, on ? 12.5 : -12.5, now);
  aimSpring(rig.arrowX, on ? 0 : 100, now);
  aimSpring(rig.arrowOpacity, on ? 1 : 0, now);
  if (!on) {
    aimSpring(rig.mx, 0, now);
    aimSpring(rig.my, 0, now);
  }
}

/** Запись кадра: слово, буквы, фото (позиция — как top/left образца, но через transform), стрелка. */
function paintRig(rig: Rig, host: HTMLElement) {
  const word = host.querySelector<HTMLElement>(".complex-documents__word");
  const shot = host.querySelector<HTMLElement>(".complex-documents__shot");
  const arrow = host.querySelector<HTMLElement>(".complex-documents__arrow");
  if (word) word.style.transform = `translateX(${rig.word.value.toFixed(2)}px)`;
  host.querySelectorAll<HTMLElement>(".complex-documents__letter").forEach((letter, index) => {
    letter.style.transform = `translateX(${(rig.letters[index]?.value ?? 0).toFixed(2)}px)`;
  });
  if (shot) {
    // Образец: left 50 % + 20 %·mx, top 50 % − 20 %·my. У нас — за названием, по горизонтали идёт за
    // курсором слабее (±48 px), по вертикали — как в образце.
    const dx = rig.anchor + rig.mx.value * 96;
    const dy = -0.2 * rig.my.value * host.offsetHeight;
    shot.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) translateY(-50%) scale(${Math.max(rig.scale.value, 0).toFixed(4)}) rotate(${rig.rotate.value.toFixed(2)}deg)`;
  }
  if (arrow) {
    arrow.style.transform = `translateX(${rig.arrowX.value.toFixed(2)}%)`;
    arrow.style.opacity = String(Math.min(Math.max(rig.arrowOpacity.value, 0), 1));
  }
}

/** Шаг всех пружин строки; true — что-то ещё движется. */
function stepRig(rig: Rig, dt: number, now: number): boolean {
  let moving = false;
  for (const spring of [rig.word, ...rig.letters, rig.scale, rig.rotate, rig.arrowX, rig.arrowOpacity, rig.mx, rig.my])
    if (stepSpring(spring, dt, now)) moving = true;
  return moving;
}

/** Курсор в долях строки −0,5…0,5 — цель пружин положения фото. */
function aimPointer(rig: Rig, host: HTMLElement, event: PointerEvent) {
  const box = host.getBoundingClientRect();
  const now = performance.now();
  aimSpring(rig.mx, (event.clientX - box.left) / box.width - 0.5, now);
  aimSpring(rig.my, (event.clientY - box.top) / box.height - 0.5, now);
}

/** Наведение мышью: пружины образца в одном цикле кадров на строку; покой — цикл стоит. */
function useHoverSprings(item: RefObject<HTMLLIElement | null>, letters: number, fine: boolean) {
  const rig = useRef<Rig | null>(null);
  const frame = useRef(0);
  const last = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const springs = () => (rig.current ??= createRig(letters));
  const tick = (now: number) => {
    frame.current = 0;
    const host = item.current;
    const current = rig.current;
    if (!host || !current) return;
    const dt = last.current ? now - last.current : 16;
    last.current = now;
    const moving = stepRig(current, dt, now);
    paintRig(current, host);
    if (moving) frame.current = requestAnimationFrame(tick);
    else last.current = 0;
  };
  const kick = () => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  };
  const live = (event: PointerEvent) => fine && event.pointerType === "mouse" && getMotionTier() === "full";
  return {
    enter: (event: PointerEvent<HTMLLIElement>) => {
      item.current?.setAttribute("data-hover", "");
      if (!live(event)) return;
      if (item.current) springs().anchor = measureAnchor(item.current);
      aimRig(springs(), true, performance.now());
      kick();
    },
    move: (event: PointerEvent<HTMLLIElement>) => {
      const host = item.current;
      if (!host || !live(event)) return;
      aimPointer(springs(), host, event);
      kick();
    },
    leave: () => {
      item.current?.removeAttribute("data-hover");
      if (!rig.current) return;
      aimRig(rig.current, false, performance.now());
      kick();
    },
  };
}
