// Памятки сотрудников (фаза F, п. 42): один источник — страница «Памятка» в кабинете и файлы
// docs/*-guide.md (собираются из него: npm run guides:md -w @vh/admin; guide.test.ts сверяет).
// Текст — обычные строки; **жирное** — единственная разметка. Модули памяток — без импорта значений:
// скрипт сборки грузит их в Node без сборщика и псевдонимов путей.

export type GuideRole = "head" | "manager" | "mobilographer";

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type GuideSection = {
  title: string;
  /** Подраздел (### в файле) — заголовок ниже уровнем. */
  sub?: true;
  blocks: GuideBlock[];
};

export type Guide = {
  role: GuideRole;
  title: string;
  lead: GuideBlock[];
  sections: GuideSection[];
};
