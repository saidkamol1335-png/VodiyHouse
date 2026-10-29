// «Ход строительства» у DEMO-ЖК (фаза 5, 5A.3): опубликованные отчёты первого блока за последние месяцы —
// кадры стройки мокапа (IMGMAP <ЖК>/m<n>-site, -siteg, -sitet: n — сколько месяцев назад), комментарий с
// пометкой DEMO, без видео (YouTube и файлы — с настоящими отчётами). У Shodlik ещё видео квартиры для
// клиента — отчёт по первой свободной квартире за этот месяц (страница /video/<id>). Месяцев с одним-двумя
// кадрами мокапа добиваются до трёх фото рендерами того же ЖК. Строки уходят каскадом с DEMO-ЖК, фото —
// с папкой ЖК (demoMedia.mjs).

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BLOB_DIR = path.join(import.meta.dirname, "..", "docs", "mockup", "source", "_blob");
const JPEG_QUALITY = 82;
const BLUR_WIDTH = 16;

// Кадры по месяцам: [0] — этот месяц, [1] — прошлый и так далее.
const FRAMES = {
  "demo-shodlik": [
    ["6c054b09607254325f4ff83b3d52ed30", "fd045581446fe26a19e96ae8b3d73cca", "3b7861bf5cb0a6f6633cd60e1622838f"],
    ["c326ae899aa8d1d329aa77c8db1d9275", "82ae5d0e37c02729a428f9aed9152f54"],
    ["470ea7918c9dd24c0c5f92756f1d964b", "dec3b32c543c391338e4b24c9b4c260d"],
    ["82d75062ec388bcd38815af70c378eeb", "fdea833f7a1abacbe6637f61abfb0c6e"],
    ["90d0230b9ba52c26a4742e40a852f261", "139f9bee4baef31a8d6f583afe18657c"],
  ],
  "demo-namuna": [
    ["48c160b4750e86d6049474c21dd4637b", "f9003641061c269b0fd97ac2091ac422", "9ef53d7ca829b842b5bd1bd43f2790e8"],
    ["07aa02e16a5c58dac977c19e23c07537", "67129fb68459a5246d58e976ee9db71d"],
    ["fbc1e8412d74c7d06bb330d5222c7971", "f7fa1b7367c54b695730079aafa9e58e"],
  ],
  "demo-yulduz": [
    ["e6ef4641c17c0ee2a600555aa5ab1ecd", "fc7ab44ccdb78d4c18232393ab56147c", "ddc66a28a9bed5ff1ecad481fdc94755"],
    ["af7ebfa3a336d461b0ccfc01613b7f91", "4555e691d0c9bed62e1a0116be0b7352"],
    ["2bab5a0605a9382852c0d6c8e893a4d7", "e223c90fbd4c3c76c3d0c5532e824e85"],
  ],
  "demo-orzu": [
    ["6f942c198c4eade7d017b8541d1583fa", "d5adf0c18ab7ba034af58f20c096b29e"],
    ["b45e68a589f6ee49c493cad3070d28d1"],
    ["6e1b1ce3ea12a58c264f5b5321649d79"],
  ],
};

// Рендеры того же ЖК (вид сверху, вечер, улица) — добить месяц до трёх фото.
const FILLERS = {
  "demo-shodlik": ["c145502a1cf6ac3678cffe2188300f3c", "24210f66520c81c2a3ad603a18e14001", "7a7044d303a2ad30feb699bfe0f0e34a"],
  "demo-namuna": ["38f79d898f2214e12dbcc196213e11cf", "e410345be72e2d3d666e89b33ddbfc43", "3fd3cee8246a99a534122d3db4930af5"],
  "demo-yulduz": ["16e643b76ac17efe94df8f950b752f89", "e0fd2933d603da12f6531316925dcaf2", "046d599967e38c33a2d07bce443f95e4"],
  "demo-orzu": ["6604a3149e89cb2236494b771f37248f", "e57b1ebddbcff9c023487dba871a0a8b", "e9070ed3ce52146f61afbc7b68875702"],
};

// Что сделано за месяц — по порядку месяцев, с пометкой DEMO.
const COMMENTS = [
  { ru: "DEMO · Залит 9-й этаж, начата кладка фасада", uz: "DEMO · 9-qavat quyildi, fasad terimi boshlandi" },
  { ru: "DEMO · Монолит 7–8 этажей, во дворе — сети", uz: "DEMO · 7–8-qavat monoliti, hovlida — tarmoqlar" },
  { ru: "DEMO · Каркас до 6-го этажа, завезены окна", uz: "DEMO · Karkas 6-qavatgacha, derazalar keltirildi" },
  { ru: "DEMO · Перекрытия 4-го этажа, лифтовые шахты", uz: "DEMO · 4-qavat yopmalari, lift shaxtalari" },
  { ru: "DEMO · Фундамент готов, начат первый этаж", uz: "DEMO · Poydevor tayyor, birinchi qavat boshlandi" },
];
const UNIT_COMMENT = {
  ru: "DEMO · Квартира: стяжка пола и штукатурка, окна установлены",
  uz: "DEMO · Kvartira: pol styajkasi va suvoq, derazalar o‘rnatildi",
};

async function preparePhoto(blobId) {
  const source = await readFile(path.join(BLOB_DIR, `${blobId}.webp`));
  const jpeg = await sharp(source).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  const { width, height } = await sharp(jpeg).metadata();
  const tiny = await sharp(source).resize({ width: BLUR_WIDTH }).jpeg({ quality: 50 }).toBuffer();
  return { jpeg, width, height, blur: `data:image/jpeg;base64,${tiny.toString("base64")}` };
}

async function uploadSet(storage, complexId, blobIds) {
  const photos = [];
  for (const blobId of blobIds) {
    const { jpeg, width, height, blur } = await preparePhoto(blobId);
    const objectPath = `complexes/${complexId}/${crypto.randomUUID()}.jpg`;
    const { error } = await storage.upload(objectPath, jpeg, { contentType: "image/jpeg" });
    if (error) throw new Error(`Storage: загрузка ${objectPath}`, { cause: error });
    photos.push({ path: objectPath, width, height, blur });
  }
  return photos;
}

const withFillers = (frames, fillers) => [...frames, ...fillers].slice(0, Math.max(3, frames.length));

/** Свободная квартира блока с планировкой — для видео квартиры (иначе отчёта по квартире нет). */
async function freeUnitOf(db, blockId) {
  const { rows } = await db.query(
    "select id from public.units where block_id = $1 and status = 'free' and layout_id is not null order by floor desc, position limit 1",
    [blockId],
  );
  return rows[0]?.id ?? null;
}

/** Файлы отчётов DEMO-ЖК в бакет; строки — insertProgressRows в транзакции сида. */
export async function uploadProgress(db, storage, complexes) {
  const items = [];
  for (const { id: complexId, slug } of complexes) {
    const months = FRAMES[slug];
    if (!months) continue;
    const { rows: blocks } = await db.query(
      "select id from public.blocks where complex_id = $1 order by sort, name limit 1",
      [complexId],
    );
    if (!blocks[0]) continue;
    const reports = [];
    for (const [ago, frames] of months.entries()) {
      reports.push({ ago, comment: COMMENTS[ago % COMMENTS.length], photos: await uploadSet(storage, complexId, withFillers(frames, FILLERS[slug])) });
    }
    const unitId = slug === "demo-shodlik" ? await freeUnitOf(db, blocks[0].id) : null;
    const unit = unitId
      ? { id: unitId, photos: await uploadSet(storage, complexId, withFillers(months[0], FILLERS[slug]).reverse()) }
      : null;
    items.push({ complexId, blockId: blocks[0].id, reports, unit });
  }
  return items;
}

const REPORT_SQL = `
  insert into public.progress_reports (
    complex_id, block_id, is_unit, unit_id, layout_id, unit_rooms, unit_area, unit_floor,
    month, comment, status, created_at, published_at
  )
  select $1, $2, $3, u.id, u.layout_id, l.rooms, l.area, u.floor,
         (date_trunc('month', private.tashkent_today()) - make_interval(months => $4))::date, $5::jsonb, 'published',
         least(now() - interval '1 hour', date_trunc('month', private.tashkent_today()) - make_interval(months => $4) + interval '1 day 7 hours 20 minutes'),
         least(now() - interval '30 minutes', date_trunc('month', private.tashkent_today()) - make_interval(months => $4) + interval '1 day 9 hours')
  from (select 1) one
  left join public.units u on u.id = $6
  left join public.layouts l on l.id = u.layout_id
  returning id`;

async function insertReport(db, complexId, blockId, ago, comment, photos, unitId = null) {
  const { rows } = await db.query(REPORT_SQL, [complexId, blockId, unitId !== null, ago, JSON.stringify(comment), unitId]);
  for (const [index, photo] of photos.entries()) {
    await db.query(
      `insert into public.progress_photos (report_id, complex_id, path, width, height, blur, sort)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [rows[0].id, complexId, photo.path, photo.width, photo.height, photo.blur, index + 1],
    );
  }
}

export async function insertProgressRows(db, items) {
  for (const { complexId, blockId, reports, unit } of items) {
    for (const { ago, comment, photos } of reports) await insertReport(db, complexId, blockId, ago, comment, photos);
    if (unit) await insertReport(db, complexId, blockId, 0, UNIT_COMMENT, unit.photos, unit.id);
  }
}

export const progressPhotoCount = (items) =>
  items.reduce((sum, item) => sum + item.reports.reduce((n, report) => n + report.photos.length, 0) + (item.unit?.photos.length ?? 0), 0);
