import type { Guide, GuideBlock } from "./types";

// Файл памятки docs/<роль>-guide.md из того же текста, что страница «Памятка» в кабинете (фаза F).

const cell = (text: string) => text.replace(/\|/g, "\\|");

function blockMarkdown(block: GuideBlock): string {
  switch (block.kind) {
    case "p":
      return block.text;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "steps":
      return block.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case "table":
      return [
        `| ${block.head.map(cell).join(" | ")} |`,
        `|${block.head.map(() => "---").join("|")}|`,
        ...block.rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
      ].join("\n");
  }
}

export function guideMarkdown(guide: Guide): string {
  const parts = [
    `# ${guide.title}`,
    "<!-- Файл собран из apps/admin/lib/admin/guide (npm run guides:md -w @vh/admin) — правьте там. -->",
    ...guide.lead.map(blockMarkdown),
  ];
  for (const section of guide.sections) {
    parts.push(
      `${section.sub ? "###" : "##"} ${section.title}`,
      ...section.blocks.map(blockMarkdown),
    );
  }
  return `${parts.join("\n\n")}\n`;
}
