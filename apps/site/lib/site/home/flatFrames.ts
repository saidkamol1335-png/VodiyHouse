import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { FlatRooms } from "./flatPicker";
import registry from "./flatFrames.json";

export type FrameSet = { count: number; width: number; height: number };
export type FlatFrames = {
  base: string;
  placeholder: boolean;
  desktop: FrameSet;
  mobile: FrameSet;
};

type Manifest = { placeholder?: boolean; desktop: FrameSet; mobile: FrameSet };

const PUBLIC = path.join(process.cwd(), "public");

/** Только заглушка в разработке: dev-сервер запущен из apps/site. */
function read(dir: string): Manifest | null {
  const file = path.join(PUBLIC, dir, "manifest.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Manifest;
  } catch {
    return null;
  }
}

/**
 * Демо-блоки главной включены (только разработка): заглушка кадров «Выберите свою квартиру» и DEMO-отзывы.
 * В сборке для сайта (NODE_ENV=production) флаг не действует — на прод заглушки не попадают.
 */
export const demoSections = () =>
  process.env.NODE_ENV !== "production" && process.env.VH_DEMO_SECTIONS === "1";

/**
 * Кадры типа квартиры. Настоящие — public/assets/flat/<n>k, их размеры — в flatFrames.json (пишет
 * scripts/frames/frames.mjs с --register <n>; JSON попадает в сборку, файловой системы на сервере не
 * нужно). Заглушка (scripts/frames/placeholder.mjs) — public/assets/flat-placeholder/<n>k, только при
 * demoSections(). Нет кадров — null: вкладки нет, без вкладок нет и секции («в прод — только с кадрами»).
 */
export function flatFrames(rooms: FlatRooms): FlatFrames | null {
  const real = (registry as Partial<Record<string, Manifest>>)[String(rooms)];
  if (real)
    return {
      base: `/assets/flat/${rooms}k`,
      placeholder: false,
      desktop: real.desktop,
      mobile: real.mobile,
    };
  if (!demoSections()) return null;
  const stub = read(`assets/flat-placeholder/${rooms}k`);
  return stub
    ? {
        base: `/assets/flat-placeholder/${rooms}k`,
        placeholder: true,
        desktop: stub.desktop,
        mobile: stub.mobile,
      }
    : null;
}
