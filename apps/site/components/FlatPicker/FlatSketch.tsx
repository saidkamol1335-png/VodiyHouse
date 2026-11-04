import type { FlatRooms } from "@/lib/site/home/flatPicker";

/** Ширины комнат верхнего ряда (м) — та же схема, что у заглушки кадров (scripts/frames/scenes). */
const ROWS: Record<FlatRooms, number[]> = {
  1: [5.2, 3.0],
  2: [3.7, 4.4, 3.0],
  3: [3.5, 3.5, 4.6, 3.0],
  4: [3.4, 3.4, 3.4, 4.6, 3.0],
};
const DEPTH = 6.6;
const ROW = 2.5;
const BATH = 2.4;

/**
 * Тонкий скетч планировки на фоне (Motion Kit №18): контур, ряд комнат, санузел. Линии проявляются
 * по прокрутке прозрачностью (--fp-reveal, по CLAUDE.md — только opacity), не stroke-dashoffset.
 */
export function FlatSketch({ rooms, active }: { rooms: FlatRooms; active: boolean }) {
  const widths = ROWS[rooms];
  const width = widths.reduce((sum, value) => sum + value, 0);
  const lines: string[] = [
    `M0 0H${width}V${DEPTH}H0Z`,
    `M0 ${DEPTH - ROW}H${width}`,
    `M${BATH} ${DEPTH - ROW}V${DEPTH}`,
  ];
  let x = 0;
  for (const value of widths.slice(0, -1)) {
    x += value;
    lines.push(`M${x} 0V${DEPTH - ROW}`);
  }
  return (
    <svg
      className="flat-picker__sketch"
      viewBox={`-0.5 -0.5 ${width + 1} ${DEPTH + 1}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      data-active={active ? "" : undefined}
    >
      {lines.map((d, index) => (
        <path
          key={d}
          d={d}
          className="flat-picker__sketch-line"
          style={{ ["--i" as string]: index / lines.length }}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Скетчи всех вкладок на фоне; виден скетч активной. */
export function FlatSketches({ rooms, active }: { rooms: FlatRooms[]; active: number }) {
  return (
    <div className="flat-picker__sketches">
      {rooms.map((value, index) => (
        <FlatSketch key={value} rooms={value} active={index === active} />
      ))}
    </div>
  );
}
