"use client";

import { type MouseEvent, type PointerEvent, useRef, useState } from "react";
import { CONTOUR_POINTS, percentPoint, type Point } from "@/lib/admin/facade/contours";
import type { FacadeImage } from "@/lib/admin/facade/types";

export type OtherContour = { key: string; label: string; points: Point[] };

type ContourEditorProps = {
  image: FacadeImage;
  alt: string;
  /** Уже нарисованные контуры — бледно, с подписью: видно, что осталось обвести. */
  others: OtherContour[];
  value: Point[];
  onChange: (points: Point[]) => void;
};

const toPoints = (points: readonly Point[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Контур по картинке (фаза 4; в мокапе редактора нет — решение в docs/design-decisions.md):
 * щелчок добавляет угол, угол тянется мышью или пальцем. Координаты — проценты картинки, как у
 * сайта (viewBox 0 0 100 100), поэтому контур не зависит от размера, в котором картинку показали.
 */
export function ContourEditor({ image, alt, others, value, onChange }: ContourEditorProps) {
  const { surface, add, move, stop, setDragging } = useContourDrag(value, onChange);
  return (
    <div
      ref={surface}
      className="facade-editor"
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
      onClick={add}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- кабинет: картинка как есть, без обрезки и next/image */}
      <img className="facade-editor__image" src={image.src} alt={alt} draggable={false} />
      <svg className="facade-editor__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {others.map((other) => (
          <polygon key={other.key} className="facade-editor__other" points={toPoints(other.points)} />
        ))}
        {value.length > 1 ? <polygon className="facade-editor__shape" points={toPoints(value)} /> : null}
      </svg>
      <EditorLabels others={others} />
      {value.map(([x, y], index) => (
        <span
          key={index}
          className="facade-editor__point"
          style={{ left: `${x}%`, top: `${y}%` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
            setDragging(index);
          }}
        />
      ))}
    </div>
  );
}

/** Подписи готовых контуров — в середине их рамки. */
function EditorLabels({ others }: { others: OtherContour[] }) {
  return others.map((other) => {
    const xs = other.points.map(([x]) => x);
    const ys = other.points.map(([, y]) => y);
    return (
      <span key={other.key} className="facade-editor__label" style={{ left: `${(Math.min(...xs) + Math.max(...xs)) / 2}%`, top: `${(Math.min(...ys) + Math.max(...ys)) / 2}%` }}>
        {other.label}
      </span>
    );
  });
}

/** Щелчок по пустому месту — новый угол, нажатие на угол — тянуть его до отпускания. */
function useContourDrag(value: Point[], onChange: (points: Point[]) => void) {
  const surface = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  // Угол только что тянули — щелчок, который придёт следом, не ставит новый.
  const dragged = useRef(false);
  const pointOf = (event: { clientX: number; clientY: number }) => {
    const box = surface.current!.getBoundingClientRect();
    return percentPoint(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
  };
  // Щелчок (касание без сдвига), а не нажатие: свайп по картинке на телефоне прокручивает страницу.
  const add = (event: MouseEvent<HTMLDivElement>) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (value.length >= CONTOUR_POINTS.max) return;
    onChange([...value, pointOf(event)]);
  };
  const stop = () => {
    if (dragging !== null) dragged.current = true;
    setDragging(null);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging === null) return;
    const next = [...value];
    next[dragging] = pointOf(event);
    onChange(next);
  };
  return { surface, add, move, stop, setDragging };
}
