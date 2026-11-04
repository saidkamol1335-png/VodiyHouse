/** Прямоугольник в системе галереи, px. */
export type PortalRect = { x: number; y: number; w: number; h: number };

const expoOut = (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
/** «Наезд камеры»: в начале полёта картинка крупнее на 6 % и доезжает до 1. */
const PUSH = 0.06;

/**
 * Ключевые кадры портала (по мотивам Portal Carousel @hyperiux, MIT) без анимации width/height и
 * clip-path: окно (outer) растёт неравномерным scale от прямоугольника источника до кадра, картинка
 * (inner) — обратным scale, поэтому на экране она растёт равномерно, а края режет overflow окна.
 * CSS не интерполирует обратный масштаб — кадры считаются заранее, гуще в начале expo-out; обе
 * анимации идут linear с одной длительностью и стартом.
 */
export function portalFrames(from: PortalRect, frame: { w: number; h: number }, steps = 28, push = PUSH) {
  const sx0 = from.w / frame.w;
  const sy0 = from.h / frame.h;
  const k0 = Math.max(sx0, sy0);
  const outer: Keyframe[] = [];
  const inner: Keyframe[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const offset = (i / steps) ** 2;
    const e = expoOut(offset);
    const sx = sx0 + (1 - sx0) * e;
    const sy = sy0 + (1 - sy0) * e;
    const k = (k0 + (1 - k0) * e) * (1 + push * (1 - e));
    outer.push({ offset, transform: `translate(${(from.x * (1 - e)).toFixed(2)}px, ${(from.y * (1 - e)).toFixed(2)}px) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})` });
    inner.push({ offset, transform: `scale(${(k / sx).toFixed(5)}, ${(k / sy).toFixed(5)})` });
  }
  return { outer, inner };
}
