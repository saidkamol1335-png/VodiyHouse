// Кадры «Выберите свою квартиру» (PLAN §10, п. 47): видео или папка PNG-рендера → WebP нужного размера
// и количества, с прозрачным фоном, для десктопа и телефона, плюс manifest.json. Node + ffmpeg, на
// Windows тоже (ffmpeg — из PATH или переменной FFMPEG).
//
//   node scripts/frames/frames.mjs <видео | папка PNG> <папка WebP> [--count 48 --width 1000]
//        [--mobile-count 24 --mobile-width 720] [--budget 2500 --mobile-budget 1000] [--placeholder]
//        [--register <1|2|3|4>]
//
// --register: настоящие кадры типа (в public/assets/flat/<n>k) — их размеры пишутся в
// lib/site/home/flatFrames.json, и сайт показывает вкладку (без этого секции на сайте нет).
//
// Бюджет — КБ на вкладку: качество снижается, пока кадры не влезут (82 → 40); не влезли — предупреждение.
// Кадры: <папка>/0001.webp… (десктоп) и <папка>/m/0001.webp… (телефон). Видео с альфой — ProRes 4444
// или WebM VP9 с альфа-каналом; в остальных фон будет непрозрачным.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    count: { type: "string", default: "48" },
    width: { type: "string", default: "1000" },
    "mobile-count": { type: "string", default: "24" },
    "mobile-width": { type: "string", default: "720" },
    budget: { type: "string", default: "2500" },
    "mobile-budget": { type: "string", default: "1000" },
    placeholder: { type: "boolean", default: false },
    register: { type: "string" },
  },
});
const [input, outDir] = positionals;
if (!input || !outDir) {
  console.error(
    "Использование: node scripts/frames/frames.mjs <видео | папка PNG> <папка WebP> [--count 48 --width 1000 --mobile-count 24 --mobile-width 720]",
  );
  process.exit(1);
}

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
// ffprobe — рядом с ffmpeg, если путь к ffmpeg задан в FFMPEG (ffmpeg.exe → ffprobe.exe в той же папке).
const FFPROBE =
  process.env.FFPROBE ??
  (process.env.FFMPEG
    ? path.join(
        path.dirname(process.env.FFMPEG),
        path.basename(process.env.FFMPEG).replace(/ffmpeg/i, "ffprobe"),
      )
    : "ffprobe");
/** Имена кадров по номеру, а не по алфавиту: frame_10 после frame_9. */
const byNumber = (a, b) => a.localeCompare(b, undefined, { numeric: true });
/** Временная папка кадров видео — убирается в конце. */
let tempDir = null;
const IMAGE = /\.(png|webp|jpe?g|tiff?)$/i;

function ffmpeg(args) {
  const result = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
  });
  if (result.error) throw new Error(`ffmpeg не запустился (${FFMPEG}): ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ffmpeg: ${result.stderr.trim()}`);
}

/** Исходные кадры по порядку: папка — как есть, видео — все кадры во временную папку PNG. */
function sourceFrames(source) {
  if (statSync(source).isDirectory()) {
    return readdirSync(source)
      .filter((name) => IMAGE.test(name))
      .sort(byNumber)
      .map((name) => path.join(source, name));
  }
  const temp = mkdtempSync(path.join(tmpdir(), "vh-frames-"));
  tempDir = temp;
  // Встроенный декодер VP8/VP9 альфу теряет — для WebM явно libvpx (он её сохраняет).
  const decoder = /\.webm$/i.test(source) ? ["-c:v", "libvpx-vp9"] : [];
  ffmpeg([...decoder, "-i", source, "-fps_mode", "passthrough", path.join(temp, "%05d.png")]);
  return readdirSync(temp)
    .sort(byNumber)
    .map((name) => path.join(temp, name));
}

/** count кадров равномерно от первого до последнего (оба включительно). */
export function pickEvenly(frames, count) {
  if (count >= frames.length) return frames;
  if (count === 1) return [frames[0]];
  return Array.from(
    { length: count },
    (_, index) => frames[Math.round((index * (frames.length - 1)) / (count - 1))],
  );
}

function encode(frames, dir, width, budgetKb) {
  mkdirSync(dir, { recursive: true });
  let quality = 82;
  for (;;) {
    let bytes = 0;
    frames.forEach((frame, index) => {
      const out = path.join(dir, `${String(index + 1).padStart(4, "0")}.webp`);
      ffmpeg([
        "-i",
        frame,
        "-vf",
        `scale=${width}:-2:flags=lanczos`,
        "-c:v",
        "libwebp",
        "-pix_fmt",
        "yuva420p",
        "-quality",
        String(quality),
        "-compression_level",
        "6",
        out,
      ]);
      bytes += statSync(out).size;
    });
    if (bytes <= budgetKb * 1024 || quality <= 40) {
      if (bytes > budgetKb * 1024)
        console.warn(
          `⚠ ${dir}: ${Math.round(bytes / 1024)} КБ > бюджета ${budgetKb} КБ даже при качестве 40 — уменьшите кадры или их число.`,
        );
      const probe = spawnSync(
        FFPROBE,
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=width,height",
          "-of",
          "csv=p=0",
          path.join(dir, "0001.webp"),
        ],
        { encoding: "utf8" },
      );
      const [w, h] = (probe.stdout ?? "").trim().split(",").map(Number);
      return {
        count: frames.length,
        width: w || width,
        height: h || 0,
        kb: Math.round(bytes / 1024),
        quality,
      };
    }
    quality = Math.max(40, quality - 8);
  }
}

const all = sourceFrames(input);
if (all.length === 0) {
  console.error(`В ${input} нет кадров.`);
  process.exit(1);
}
rmSync(outDir, { recursive: true, force: true });
let desktop;
let mobile;
try {
  desktop = encode(
    pickEvenly(all, Number(values.count)),
    outDir,
    Number(values.width),
    Number(values.budget),
  );
  mobile = encode(
    pickEvenly(all, Number(values["mobile-count"])),
    path.join(outDir, "m"),
    Number(values["mobile-width"]),
    Number(values["mobile-budget"]),
  );
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}
const manifest = { placeholder: values.placeholder, desktop, mobile };
writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `${outDir}: десктоп ${desktop.count} × ${desktop.width} px — ${desktop.kb} КБ (q${desktop.quality}); телефон ${mobile.count} × ${mobile.width} px — ${mobile.kb} КБ (q${mobile.quality})`,
);
if (values.register) {
  const file = path.join(import.meta.dirname, "..", "..", "lib", "site", "home", "flatFrames.json");
  const registry = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  registry[values.register] = { desktop, mobile };
  writeFileSync(
    file,
    `${JSON.stringify(registry, null, 2)}
`,
  );
  console.log(
    `Вкладка ${values.register} зарегистрирована в ${path.relative(process.cwd(), file)}`,
  );
}
