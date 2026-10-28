// «Выбрать квартиру» у DEMO-ЖК (фаза 4, 4.2): фасад — рендер мокапа (PH в Main.dc.html) с пометкой
// DEMO, контуры блоков — VISPOLY мокапа (проценты кадра, размечены по рендерам приблизительно), планы
// этажей — схема мокапа (PLAN_K: секция подъезда 400 × 300, квартиры вокруг лестницы и лифтов),
// нарисованная в PNG с пометкой DEMO, по плану на подъезд блока на все его этажи. Контур квартиры —
// её клетка схемы: место на этаже N — клетка N. Настоящие фасады и планы загружает руководитель.

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BLOB_DIR = path.join(import.meta.dirname, "..", "docs", "mockup", "source", "_blob");
// Рендеры мокапа 700–900 px: для DEMO растягиваем до 1800 — на сайте кадр не шире контейнера.
const FACADE_WIDTH = 1800;
const PLAN_SCALE = 4;

const FACADES = {
  "demo-shodlik": {
    blob: "4d567f11e9574b5a6c05ca1a398e63c6",
    blocks: { A: "20,49 27,46 28,40 38,36 48,33 52,33 52,76 28,77 20,71", B: "52,33 60,31 70,31 80,32 86,35 86,72 75,74 52,76" },
  },
  "demo-namuna": { blob: "f0736706b8b52f1d09b856e6967ffffc", blocks: { 1: "21,72 26,28 32,7 41,2 48,5 55,17 58,32 60,60 61,74" } },
  "demo-yulduz": { blob: "cc44ca22297346e80a350a10e0c5090f", blocks: { 1: "43,30 46,16 53,11 59,15 60,30 60,66 43,66" } },
  "demo-orzu": {
    blob: "78e3082f110a7a069370a3667b47dcfb",
    blocks: { 1: "11,57 17,55 25,56 25,88 11,88", 2: "25,6 31,1 44,2 60,10 75,20 87,33 87,88 25,88" },
  },
};

// Схема этажа мокапа: клетки квартир [x, y, ширина, высота] и ядро в секции 400 × 300.
const SCHEMES = {
  4: { cells: [[0, 0, 150, 300], [150, 0, 112, 158], [262, 0, 138, 150], [262, 150, 138, 150]], core: [150, 158, 112, 142] },
  3: { cells: [[0, 0, 150, 300], [150, 0, 250, 150], [262, 150, 138, 150]], core: [150, 150, 112, 150] },
};

const DEMO_MARK = (x, y, size) =>
  `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="700" fill="#b45309" fill-opacity="0.85">DEMO</text>`;

const contourOf = (points) => points.split(" ").map((pair) => pair.split(",").map(Number));

async function facadeImage(blob) {
  const raw = await readFile(path.join(BLOB_DIR, `${blob}.webp`));
  const resized = await sharp(raw).resize({ width: FACADE_WIDTH, kernel: "lanczos3" }).toBuffer();
  const { width, height } = await sharp(resized).metadata();
  const mark = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="${width - 196}" y="${height - 76}" width="172" height="56" rx="12" fill="#ffffff" fill-opacity="0.8"/>${DEMO_MARK(width - 178, height - 33, 36)}</svg>`,
  );
  const jpeg = await sharp(resized).composite([{ input: mark }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const tiny = await sharp(resized).resize({ width: 16 }).jpeg({ quality: 50 }).toBuffer();
  return { buffer: jpeg, width, height, blur: `data:image/jpeg;base64,${tiny.toString("base64")}`, ext: "jpg", type: "image/jpeg" };
}

/** Схема секции подъезда в PNG: стены, ядро со штриховкой, пометка DEMO. */
async function planImage(scheme, entrance) {
  const s = PLAN_SCALE;
  const width = 400 * s;
  const height = 300 * s;
  const rect = ([x, y, w, h], extra) => `<rect x="${x * s}" y="${y * s}" width="${w * s}" height="${h * s}" ${extra}/>`;
  const [cx, cy, cw, ch] = scheme.core;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><pattern id="h" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="24" fill="#e7e2d9"/></pattern></defs>
    <rect width="${width}" height="${height}" fill="#ffffff"/>
    ${scheme.cells.map((cell) => rect(cell, 'fill="#fbf9f5" stroke="#3f3a33" stroke-width="10"')).join("")}
    ${rect(scheme.core, 'fill="url(#h)" stroke="#3f3a33" stroke-width="10"')}
    <text x="${(cx + cw / 2) * s}" y="${(cy + ch / 2) * s}" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" fill="#6b645a">Подъезд ${entrance}</text>
    ${DEMO_MARK((cx + cw / 2) * s - 62, (cy + ch / 2) * s + 64, 44)}
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer: png, width, height, blur: null, ext: "png", type: "image/png" };
}

/** Контуры квартир плана: клетка схемы с отступом 1,2 % внутрь — стены остаются видны. */
function planContours(scheme, entrance) {
  const pct = (value, total) => Math.round((value / total) * 10000) / 100;
  return scheme.cells.map(([x, y, w, h], index) => {
    const [x0, y0, x1, y1] = [pct(x, 400) + 1.2, pct(y, 300) + 1.2, pct(x + w, 400) - 1.2, pct(y + h, 300) - 1.2];
    return { entrance, position: index + 1, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] };
  });
}

async function blocksOf(db, complexId) {
  const { rows } = await db.query(
    `select b.id, b.name, min(u.floor) as floor_from, max(u.floor) as floor_to,
            array_agg(distinct u.entrance order by u.entrance) as entrances, max(u.position) as per_floor
     from public.blocks b join public.units u on u.block_id = b.id
     where b.complex_id = $1 group by b.id, b.name order by b.sort, b.name`,
    [complexId],
  );
  return rows;
}

/** Файлы фасадов и планов DEMO-ЖК в бакет; строки — insertPickerRows в транзакции сида. */
export async function uploadPicker(db, storage, complexes) {
  const items = [];
  const put = async (complexId, image) => {
    const objectPath = `complexes/${complexId}/${crypto.randomUUID()}.${image.ext}`;
    const { error } = await storage.upload(objectPath, image.buffer, { contentType: image.type });
    if (error) throw new Error(`Storage: загрузка ${objectPath}`, { cause: error });
    return { path: objectPath, width: image.width, height: image.height, blur: image.blur };
  };
  for (const { id: complexId, slug } of complexes) {
    const facade = FACADES[slug];
    if (!facade) continue;
    const blocks = await blocksOf(db, complexId);
    const plans = [];
    for (const block of blocks) {
      const scheme = SCHEMES[block.per_floor];
      if (!scheme) continue;
      for (const entrance of block.entrances) {
        plans.push({ block, entrance, image: await put(complexId, await planImage(scheme, entrance)), contours: planContours(scheme, entrance) });
      }
    }
    items.push({ complexId, facade: await put(complexId, await facadeImage(facade.blob)), contours: facade.blocks, blocks, plans });
  }
  return items;
}

/** Строки фасада, контуров блоков и планов этажей (вызывается внутри транзакции сида). */
export async function insertPickerRows(db, items) {
  for (const { complexId, facade, contours, blocks, plans } of items) {
    await db.query(
      `insert into public.media_assets (complex_id, kind, path, width, height, blur) values ($1, 'facade', $2, $3, $4, $5)`,
      [complexId, facade.path, facade.width, facade.height, facade.blur],
    );
    for (const block of blocks) {
      if (!contours[block.name]) continue;
      await db.query("update public.blocks set facade_contour = $1 where id = $2", [JSON.stringify(contourOf(contours[block.name])), block.id]);
    }
    for (const { block, entrance, image, contours: units } of plans) {
      const { rows } = await db.query(
        `insert into public.media_assets (complex_id, kind, path, width, height) values ($1, 'floor_plan', $2, $3, $4) returning id`,
        [complexId, image.path, image.width, image.height],
      );
      await db.query(
        `insert into public.floor_plans (complex_id, block_id, entrance, floor_from, floor_to, image_id, contours)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [complexId, block.id, entrance, block.floor_from, block.floor_to, rows[0].id, JSON.stringify(units)],
      );
    }
  }
}
