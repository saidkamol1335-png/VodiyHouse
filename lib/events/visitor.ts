import type { Device } from "./types";

// Кто пришёл (шаг 3.12): боты и сотрудники в события не попадают, устройство — по user-agent.
// Модель устройства не определяем (CLAUDE.md §3) — только «телефон, планшет, компьютер».

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pagespeed|curl|wget|python|axios/i;
const TABLET = /ipad|tablet|playbook|silk|(android(?!.*mobi))/i;
const MOBILE = /mobi|iphone|ipod|android|windows phone/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent);
}

export function deviceOf(userAgent: string | null): Device {
  if (!userAgent) return "desktop";
  if (TABLET.test(userAgent)) return "tablet";
  return MOBILE.test(userAgent) ? "mobile" : "desktop";
}
