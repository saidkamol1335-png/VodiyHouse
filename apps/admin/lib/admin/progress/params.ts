// Параметры адресов раздела «Видео и ход стройки» (фаза E): id отчёта, ЖК, блока — только UUID.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idParam = (raw: string | string[] | undefined): string | null =>
  typeof raw === "string" && UUID.test(raw) ? raw : null;
