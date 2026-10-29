// График «Статистики сайта» (фаза 6, мокап CabStats, vmStats): ось Y — 4 деления с «круглым» шагом
// (1, 2, 2,5, 5, 10 × 10ⁿ), подписи X — до 7 меток (сегодня — 00, 04, 08, 12, 16, 20, 23 ч),
// линия и заливка выбранного периода, пунктир прошлого. Координаты — в поле 1000 × 300 (SVG
// растягивается по ширине панели, preserveAspectRatio="none").

export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 300;
const Y_STEPS = 4;
const X_LABELS = 7;
const HOUR_LABELS = [0, 4, 8, 12, 16, 20, 23];

/** Шаг оси Y: максимум делится на 4 и округляется вверх до 1, 2, 2,5, 5 или 10 × 10ⁿ (не меньше 1). */
export function chartStep(max: number): number {
  const raw = Math.max(1, max) / Y_STEPS;
  const power = 10 ** Math.floor(Math.log10(raw));
  const mantissa = raw / power;
  const nice =
    mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 2.5 ? 2.5 : mantissa <= 5 ? 5 : 10;
  return Math.max(1, nice * power);
}

/** Деления оси Y снизу вверх: 0, шаг, … 4 шага. */
export function chartTicks(max: number): number[] {
  const step = chartStep(max);
  return Array.from({ length: Y_STEPS + 1 }, (_, index) => index * step);
}

/** Какие точки подписать по X: сегодня — фиксированные часы, иначе до 7 равномерно с концами. */
export function chartLabelIndexes(count: number, hourly: boolean): number[] {
  if (count <= 0) return [];
  if (hourly) return HOUR_LABELS.filter((hour) => hour < count);
  const steps = Math.min(count, X_LABELS);
  if (steps === 1) return [0];
  const indexes = Array.from({ length: steps }, (_, index) =>
    Math.round((index * (count - 1)) / (steps - 1)),
  );
  return [...new Set(indexes)];
}

export const chartX = (index: number, count: number) =>
  count <= 1 ? CHART_WIDTH / 2 : (index / (count - 1)) * CHART_WIDTH;
export const chartY = (value: number, top: number) => CHART_HEIGHT - (value / top) * CHART_HEIGHT;

const point = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

export type ChartPaths = { line: string; area: string; prev: string; top: number };

/**
 * Пути SVG: линия и заливка периода (null — час ещё не наступил, линия обрывается), пунктир прошлого.
 * Одна точка — горизонталь через всё поле, как в мокапе.
 */
export function chartPaths(
  current: readonly (number | null)[],
  previous: readonly number[] | null,
): ChartPaths {
  const count = current.length;
  const top =
    chartStep(Math.max(0, ...current.map((value) => value ?? 0), ...(previous ?? []))) * Y_STEPS;
  const drawn = current.flatMap((value, index) =>
    value === null ? [] : [[chartX(index, count), chartY(value, top)] as const],
  );
  let line = drawn.map(([x, y], index) => `${index === 0 ? "M" : "L"}${point(x, y)}`).join("");
  let area =
    drawn.length > 0
      ? `M${point(drawn[0]![0], CHART_HEIGHT)}${line.replace(/^M/, "L")}L${point(drawn.at(-1)![0], CHART_HEIGHT)}Z`
      : "";
  if (count === 1 && drawn.length === 1) {
    const y = drawn[0]![1];
    line = `M${point(0, y)}L${point(CHART_WIDTH, y)}`;
    area = `M${point(0, CHART_HEIGHT)}L${point(0, y)}L${point(CHART_WIDTH, y)}L${point(CHART_WIDTH, CHART_HEIGHT)}Z`;
  }
  const prev = previous
    ? previous
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"}${point(chartX(index, previous.length), chartY(value, top))}`,
        )
        .join("")
    : "";
  return { line, area, prev, top };
}
