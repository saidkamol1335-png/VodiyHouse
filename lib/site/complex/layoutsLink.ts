import { COMPLEX_ANCHORS } from "./sections";
import type { LayoutFilter } from "./layouts";

// Переход к «Планировкам» с фильтром или сразу к расчёту — из карточки блока («Рассчитать
// платёж» открывает расчёт самой дешёвой планировки блока, мокап openCalcFrom) и из строки
// «Наличия»: href — якорь раздела (без JS — просто к разделу), что применить — в data-layouts.
// Тот же запрос в адресе («#planirovki?komnat=2») работает и как ссылка, присланная клиенту.

const PREFIX = `#${COMPLEX_ANCHORS.layouts}`;

export type LayoutsTarget = LayoutFilter & {
  /** Планировка, расчёт которой открыть. */
  plan: string | null;
};

export function layoutsQuery(target: Partial<LayoutsTarget>): string {
  const params = new URLSearchParams();
  if (target.plan) params.set("plan", target.plan);
  if (target.blockId) params.set("blok", target.blockId);
  if (target.rooms !== undefined && target.rooms !== null) params.set("komnat", String(target.rooms));
  return params.toString();
}

/** Пропсы ссылки: якорь раздела и запрос для ComplexPlans. */
export function layoutsLinkProps(target: Partial<LayoutsTarget>): { href: string; "data-layouts": string } {
  return { href: PREFIX, "data-layouts": layoutsQuery(target) };
}

/** Запрос «plan=…&blok=…&komnat=…» (или якорь «#planirovki?…»); чужой якорь — null. */
export function parseLayoutsLink(hash: string): LayoutsTarget | null {
  if (hash !== PREFIX && !hash.startsWith(`${PREFIX}?`)) return null;
  const params = new URLSearchParams(hash.slice(PREFIX.length + 1));
  const rooms = Number(params.get("komnat"));
  return {
    plan: params.get("plan") || null,
    blockId: params.get("blok") || null,
    rooms: params.has("komnat") && Number.isInteger(rooms) && rooms >= 0 ? rooms : null,
  };
}
