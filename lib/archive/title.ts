// Подпись архивного ЖК или застройщика в Telegram (шаг 3.13): у ЖК название на двух языках, у
// застройщика — одно (бренд латиницей); руководитель читает по-русски.

export type ArchiveName = { kind: "complex" | "developer"; name: { ru: string; uz: string } | string };

export function archiveTitle({ kind, name }: ArchiveName): string {
  const text = typeof name === "string" ? name : name.ru;
  return kind === "complex" ? `ЖК «${text}»` : `Застройщик «${text}» со всеми ЖК`;
}
