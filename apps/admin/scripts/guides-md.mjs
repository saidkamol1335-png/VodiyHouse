// Памятки docs/*-guide.md из текста страницы «Памятка» кабинета (фаза F, п. 42):
// npm run guides:md -w @vh/admin. Править текст — в lib/admin/guide, не в docs.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { HEAD_GUIDE } from "../lib/admin/guide/head.ts";
import { MANAGER_GUIDE } from "../lib/admin/guide/manager.ts";
import { guideMarkdown } from "../lib/admin/guide/markdown.ts";
import { MOBILOGRAPHER_GUIDE } from "../lib/admin/guide/mobilographer.ts";

const ROOT = path.join(import.meta.dirname, "..", "..", "..");
const FILES = [
  [HEAD_GUIDE, "docs/head-guide.md"],
  [MANAGER_GUIDE, "docs/manager-guide.md"],
  [MOBILOGRAPHER_GUIDE, "docs/mobilographer-guide.md"],
];

for (const [guide, file] of FILES) {
  await writeFile(path.join(ROOT, file), guideMarkdown(guide));
  console.log(`✓ ${file}`);
}
