// Статусы публикации ЖК и застройщика — как enum publication_status в базе (PLAN §3.12):
// hidden — скрыт с сайта, archived — в архиве 30 дней, потом удаляется.
export const PUBLICATION_STATUSES = ["draft", "published", "hidden", "archived"] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
