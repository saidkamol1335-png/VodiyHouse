// Переносы сроков сдачи (ТЗ 7.3в, решение фазы 3 «Мастер ЖК»): запись «было → стало» появляется,
// когда руководитель сохраняет новый срок блока с отметкой «это перенос». Ошибочную запись
// убирают из истории на той же вкладке «Блоки».

export type Quarter = { year: number; quarter: number };

export type DeadlineChange = {
  id: string;
  blockId: string;
  from: Quarter;
  to: Quarter;
  /** «2026-08-20» — когда перенос записан. */
  changedOn: string;
};

/** Срок в черновике блока отличается от сохранённого — новый срок может быть переносом. */
export function deadlineMoved(saved: Quarter | null, draft: { year: number | null; quarter: number | null }): boolean {
  if (!saved || draft.year === null || draft.quarter === null) return false;
  return saved.year !== draft.year || saved.quarter !== draft.quarter;
}
