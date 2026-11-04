// Заглушка кадров «Выберите свою квартиру» для разработки (PLAN §10, п. 47): процедурная квартира
// 1/2/3 комнаты → public/assets/flat-placeholder/{1,2,3}k (в .gitignore, на прод не попадает: сайт
// берёт её только в разработке с VH_DEMO_SECTIONS=1). Настоящие кадры — scripts/frames/frames.mjs в
// public/assets/flat/{1,2,3}k.
//
//   npm run frames:placeholder -w @vh/site

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SITE = path.join(import.meta.dirname, "..", "..");
const OUT = path.join(SITE, "public", "assets", "flat-placeholder");
const run = (script, args) =>
  execFileSync(process.execPath, [path.join(import.meta.dirname, script), ...args], {
    stdio: "inherit",
    cwd: SITE,
  });

for (const rooms of [1, 2, 3]) {
  const png = mkdtempSync(path.join(tmpdir(), `vh-dollhouse-${rooms}-`));
  try {
    run("render.mjs", ["dollhouse", png, "--count", "48", "--query", `rooms=${rooms}`]);
    run("frames.mjs", [png, path.join(OUT, `${rooms}k`), "--placeholder"]);
  } finally {
    rmSync(png, { recursive: true, force: true });
  }
}
