import { APP_TIME_ZONE, hourIn } from "@/lib/format";

export type GreetingKey = "morning" | "day" | "evening";

// Мокап всегда пишет «Добрый день»; по решению К4.3 — по времени суток Ташкента.
const MORNING_FROM = 5;
const DAY_FROM = 12;
const EVENING_FROM = 18;

export function greetingOf(date: Date, timeZone: string = APP_TIME_ZONE): GreetingKey {
  const hour = hourIn(date, timeZone);
  if (hour >= MORNING_FROM && hour < DAY_FROM) return "morning";
  if (hour >= DAY_FROM && hour < EVENING_FROM) return "day";
  return "evening";
}
