import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import { GUIDE_FILES, GUIDES } from ".";
import { guideMarkdown } from "./markdown";

const ROOT = path.join(import.meta.dirname, "..", "..", "..", "..", "..");

describe("памятки сотрудников (фаза F, п. 42)", () => {
  it.each(Object.entries(GUIDE_FILES))("docs-файл %s собран из текста кабинета", (role, file) => {
    const onDisk = readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
    expect(onDisk, "запустите npm run guides:md -w @vh/admin").toBe(
      guideMarkdown(GUIDES[role as keyof typeof GUIDES]),
    );
  });

  it("docs/publication-rule.md ссылается на разделы памятки руководителя — они на месте", () => {
    const titles = GUIDES.head.sections.map((section) => section.title);
    expect(titles).toContain("Почему ЖК в режиме «Скоро» и как дозаполнить");
    expect(titles).toContain("Почему квартира не видна на сайте");
  });

  it("памятка мобилографа повторяет «Как снимать» кабинета дословно", () => {
    const howTo = GUIDES.mobilographer.sections.find(
      (section) => section.title === "2. Как снимать",
    )!;
    const items = howTo.blocks.flatMap((block) => (block.kind === "list" ? block.items : []));
    expect(items).toEqual(Object.values(ru.admin.video.howTo.items).map((item) => `${item}.`));
  });
});
