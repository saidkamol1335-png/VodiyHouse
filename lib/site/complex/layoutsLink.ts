import { COMPLEX_ANCHORS } from "./sections";
import type { LayoutFilter } from "./layouts";

// Переход к «Планировкам» с фильтром — из карточки блока («Рассчитать платёж») и из строки
// «Наличия» на телефоне: якорь раздела и фильтр в одной ссылке. Без JS — просто якорь раздела.

const PREFIX = `#${COMPLEX_ANCHORS.layouts}`;

export function layoutsLink(filter: Partial<LayoutFilter>): string {
  const params = new URLSearchParams();
  if (filter.blockId) params.set("blok", filter.blockId);
  if (filter.rooms !== undefined && filter.rooms !== null) params.set("komnat", String(filter.rooms));
  const query = params.toString();
  return query ? `${PREFIX}?${query}` : PREFIX;
}

/** Фильтр из якоря «#planirovki?blok=…&komnat=…»; чужой якорь — null. */
export function parseLayoutsLink(hash: string): LayoutFilter | null {
  if (hash !== PREFIX && !hash.startsWith(`${PREFIX}?`)) return null;
  const params = new URLSearchParams(hash.slice(PREFIX.length + 1));
  const rooms = Number(params.get("komnat"));
  return {
    blockId: params.get("blok") || null,
    rooms: params.has("komnat") && Number.isInteger(rooms) && rooms >= 0 ? rooms : null,
  };
}
