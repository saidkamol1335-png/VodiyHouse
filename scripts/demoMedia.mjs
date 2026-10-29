// Фото DEMO-ЖК в Storage (фаза 3, шаг 3.1): рендеры мокапа (docs/mockup/source/_blob) → JPEG в
// бакет media + строки media_assets. Без чужих водяных знаков: рендеры мокапа — свои. Мокап даёт
// 1200 × 900 — меньше порога загрузки кабинета (1600 px), растягивать их бессмысленно; настоящие фото
// пройдут проверку кабинета. Удаление — по папкам DEMO-ЖК и застройщиков после remove.sql (строки
// уходят каскадом с ЖК): если его проверки остановят удаление, фото DEMO останутся на месте.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { insertPickerRows, uploadPicker } from "./demoPicker.mjs";
import { insertProgressRows, progressPhotoCount, uploadProgress } from "./demoProgress.mjs";

const BLOB_DIR = path.join(import.meta.dirname, "..", "docs", "mockup", "source", "_blob");
const BUCKET = "media";
const PROGRESS_VIDEO_BUCKET = "progress-video";
const JPEG_QUALITY = 82;
// Заглушка, пока грузится фото: ~16 px по ширине — несколько сотен байт data URL (лимит базы 4000).
const BLUR_WIDTH = 16;

// Рендеры мокапа (IMGMAP в docs/mockup/source/project/Main.dc.html): вид сверху, вечер, улица;
// у Shodlik и Namuna ещё двор и деталь. Первое фото галереи — обложка.
const MOCKUP_SETS = {
  shodlik: ["c145502a1cf6ac3678cffe2188300f3c", "24210f66520c81c2a3ad603a18e14001", "7a7044d303a2ad30feb699bfe0f0e34a", "1cb4c474b6a0f467740c418d402ee94c", "0a0d2b6ae29517d673d188b631e5a022"],
  namuna: ["38f79d898f2214e12dbcc196213e11cf", "e410345be72e2d3d666e89b33ddbfc43", "3fd3cee8246a99a534122d3db4930af5", "cda3d3df9118a8cf390f5f7a700c5ee6", "be3b6a18349a4328f8e84d303f7631b8"],
  yulduz: ["16e643b76ac17efe94df8f950b752f89", "e0fd2933d603da12f6531316925dcaf2", "046d599967e38c33a2d07bce443f95e4"],
  orzu: ["6604a3149e89cb2236494b771f37248f", "e57b1ebddbcff9c023487dba871a0a8b", "e9070ed3ce52146f61afbc7b68875702"],
  bahor: ["37af1c4bfe13b9a68b3bcae3da35e7d1", "6a00f0bdac6664fdc3a91371a82f7a2e", "b88ab82cbcacb2f5099de6a644f88b05"],
  gulzor: ["ca48e25088e67b413eee7bd5057026e7", "822c8297bac35358d4069e46fa0a3872", "b8618d0a2800d570062f94b232010bb6"],
  nur: ["47fcd99ae8b4ebf2447a692dc30673e6", "795fdb12ceb53738f9aaac91d4743f3d", "8fa9d5bc285bdb641cbafa7d70a001ff"],
  lola: ["28383744bf084483b961861af9b579b7", "9a2e9b35b3f6a176633ae0834ff88dde", "0c8a807024312e8771d56110be1ba913"],
  dostlik: ["511707cf0ef92e0340c7bb57ab7f3f1a", "4d04d7cf39e678c9e7d26c7f1992e56d", "8678c9ca5af85cdb569b69a140013d03"],
  mehr: ["634f8b7a205c614e4bb38a2394fedbb3", "7757b282190f86bc31353c418d460edd", "294cd0246c46125eb9eecfb02cdfca17"],
  sayhun: ["e8f08b3666eb53ec7c8ee5da2eb362e8", "2409d91699490a6171c9fa26bdd5fd35", "f43aefdedd19496e0fd494a9182de5fd"],
};
const LOAD_SETS = ["bahor", "gulzor", "nur", "lola", "dostlik", "mehr", "sayhun", "shodlik", "namuna", "yulduz", "orzu"];

// «Худший случай» (PLAN 3а): 5 фото разных пропорций — шаблоны не должны ломаться ни на одном.
const WORST_CROPS = [16 / 9, 4 / 5, 1, 21 / 9, 3 / 4];

/** Фото DEMO-ЖК: [рендер, кадрирование (пропорция или null — как есть)] по порядку галереи. */
function photoPlan(slug) {
  if (slug === "demo-worst") return MOCKUP_SETS.sayhun.concat(MOCKUP_SETS.mehr.slice(0, 2)).map((id, i) => [id, WORST_CROPS[i]]);
  if (slug === "demo-best") return MOCKUP_SETS.namuna.map((id) => [id, null]);
  const load = /^demo-load-(\d+)$/.exec(slug);
  if (load) return MOCKUP_SETS[LOAD_SETS[(Number(load[1]) - 1) % LOAD_SETS.length]].map((id) => [id, null]);
  const own = MOCKUP_SETS[slug.replace(/^demo-/, "")];
  return own ? own.map((id) => [id, null]) : [];
}

function storageClient(bucket = BUCKET) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SECRET_KEY в .env.local.");
  return createClient(url, key, { auth: { persistSession: false } }).storage.from(bucket);
}

async function demoComplexIds(db) {
  const { rows } = await db.query("select id, slug from public.complexes where slug like 'demo-%'");
  return rows;
}

/** Кадр по центру нужной пропорции из рендера 1200 × 900. */
async function cropTo(source, ratio) {
  const { width, height } = await sharp(source).metadata();
  const cropWidth = Math.min(width, Math.round(height * ratio));
  const cropHeight = Math.min(height, Math.round(cropWidth / ratio));
  const left = Math.round((width - cropWidth) / 2);
  const top = Math.round((height - cropHeight) / 2);
  return sharp(source).extract({ left, top, width: cropWidth, height: cropHeight }).toBuffer();
}

async function preparePhoto(blobId, ratio) {
  const raw = await readFile(path.join(BLOB_DIR, `${blobId}.webp`));
  const source = ratio ? await cropTo(raw, ratio) : raw;
  const jpeg = await sharp(source).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  const { width, height } = await sharp(jpeg).metadata();
  const tiny = await sharp(source).resize({ width: BLUR_WIDTH }).jpeg({ quality: 50 }).toBuffer();
  return { jpeg, width, height, blur: `data:image/jpeg;base64,${tiny.toString("base64")}` };
}

/**
 * Папки DEMO в бакете: ЖК (фото сида) и застройщики (логотип и фон, если их грузили в кабинете).
 * Узнать их можно только до remove.sql — после него id DEMO уже нет.
 */
export async function demoMediaFolders(db) {
  const { rows } = await db.query(
    `select 'complexes/' || id as folder from public.complexes where slug like 'demo-%'
     union all
     select 'developers/' || id from public.developers where slug like 'demo-%'`,
  );
  return rows.map((row) => row.folder);
}

/**
 * Удаляет файлы папок — после remove.sql: откатился он (проверки DEMO) — файлы целы. Видео отчётов
 * хода строительства (фаза 5), которые снимали на DEMO-ЖК в кабинете, — та же папка в progress-video.
 */
export async function removeMediaFolders(folders) {
  let removed = 0;
  for (const [bucket, list] of [[BUCKET, folders], [PROGRESS_VIDEO_BUCKET, folders.filter((folder) => folder.startsWith("complexes/"))]]) {
    removed += await clearFolders(storageClient(bucket), list);
  }
  return removed;
}

async function clearFolders(storage, folders) {
  let removed = 0;
  for (const folder of folders) {
    const { data, error } = await storage.list(folder, { limit: 1000 });
    if (error) throw new Error(`Storage: список ${folder}`, { cause: error });
    if (!data.length) continue;
    const { error: removeError } = await storage.remove(data.map((file) => `${folder}/${file.name}`));
    if (removeError) throw new Error(`Storage: удаление ${folder}`, { cause: removeError });
    removed += data.length;
  }
  return removed;
}

async function uploadPhotos(complexes) {
  const storage = storageClient();
  const rows = [];
  for (const { id: complexId, slug } of complexes) {
    for (const [sort, [blobId, ratio]] of photoPlan(slug).entries()) {
      const { jpeg, width, height, blur } = await preparePhoto(blobId, ratio);
      const objectPath = `complexes/${complexId}/${crypto.randomUUID()}.jpg`;
      const { error } = await storage.upload(objectPath, jpeg, { contentType: "image/jpeg" });
      if (error) throw new Error(`Storage: загрузка ${objectPath}`, { cause: error });
      rows.push([complexId, objectPath, width, height, blur, sort]);
    }
  }
  return rows;
}

// Чертежи планировок мокапа (IMGMAP plan/<ЖК>-<n>, шаг 3.5): n — порядок планировок в сиде (блок,
// затем планировка) — подписи «1-комн. · 42,5 м²» на чертежах совпадают. Хранятся PNG на белом
// листе, как чертежи кабинета; у стресс-DEMO чертежей нет.
const PLAN_SETS = {
  shodlik: ["b80fffaf0f9ed249866b4634c49bfba2", "3394e9026d59401f326357647df46f61", "dc10f4956102957c5fa8a8cf2a8321cc", "979219668d03f3e667d2d6a3c81e5fe7", "53e82257a70a9f9532230dee948891d5", "78749704750e54c17127972206266ce2", "c54e08513d25eb8550df0990149085a7", "f0ae1cde7d4a09078118a4916e2cf6c2"],
  namuna: ["cfe37a9e621fc12835b7de887b6c1643", "5e209d1f74ff4bd6b2e6e82610727838", "d799dc37b6484fb516482220435e8ba1", "d465c412f049da95a57f47fb429e7a8d", "d97841127d5d5c04d0c503a5b7d2ee04", "16a0b6042b9f48aeec155730f4ab857e", "f6ee94f78e5462db2881f9f158e1963e"],
  yulduz: ["8f6741f77a5a4168561f8cbff39505bd", "4f9c8e68060e7142a2f91889e92243b6", "558c13d93e2eaa1c304131eddd757466", "b9ce6591db60c3768d189c7b1d56a9b9"],
  orzu: ["6ed4908db6b4d1999fab03e61f8e5e3f", "1bd1298c378b8f8a77ddb07b1574a57b", "fc042a24418426dcc496b17c104c1e95", "6cf69bb6facecfeefe50f484ad9ecddf", "9d3c5cfda54721c9f36d0bad659ffe30", "24765b55bbeaf5a869f26b67748dfc36", "6b8b1415a3611aa81ce4a14b5b25fd32"],
};

async function layoutIdsOf(db, complexId) {
  const { rows } = await db.query(
    `select l.id from public.layouts l join public.blocks b on b.id = l.block_id
     where b.complex_id = $1 order by b.sort, b.name, l.sort`,
    [complexId],
  );
  return rows.map((row) => row.id);
}

async function uploadDrawings(db, complexes) {
  const storage = storageClient();
  const rows = [];
  for (const { id: complexId, slug } of complexes) {
    const layouts = await layoutIdsOf(db, complexId);
    for (const [index, blobId] of (PLAN_SETS[slug.replace(/^demo-/, "")] ?? []).entries()) {
      if (!layouts[index]) break;
      const raw = await readFile(path.join(BLOB_DIR, `${blobId}.webp`));
      const png = await sharp(raw).flatten({ background: "#ffffff" }).png().toBuffer();
      const { width, height } = await sharp(png).metadata();
      const objectPath = `complexes/${complexId}/${crypto.randomUUID()}.png`;
      const { error } = await storage.upload(objectPath, png, { contentType: "image/png" });
      if (error) throw new Error(`Storage: загрузка ${objectPath}`, { cause: error });
      rows.push([complexId, layouts[index], objectPath, width, height]);
    }
  }
  return rows;
}

async function insertMediaRows(db, photos, drawings) {
  for (const [complexId, objectPath, width, height, blur, sort] of photos) {
    await db.query(
      `insert into public.media_assets (complex_id, kind, path, width, height, blur, focus_x, focus_y, sort)
       values ($1, 'photo', $2, $3, $4, $5, $6, $7, $8)`,
      // Фокус чуть ниже центра: на рендерах мокапа дом в нижней половине, сверху небо.
      [complexId, objectPath, width, height, blur, 0.5, 0.55, sort],
    );
  }
  for (const [complexId, layoutId, objectPath, width, height] of drawings) {
    const { rows } = await db.query(
      `insert into public.media_assets (complex_id, kind, path, width, height)
       values ($1, 'drawing', $2, $3, $4) returning id`,
      [complexId, objectPath, width, height],
    );
    await db.query("update public.layouts set drawing_id = $1 where id = $2", [rows[0].id, layoutId]);
  }
}

/**
 * Загружает фото, чертежи, фасады, планы этажей и отчёты хода строительства DEMO-ЖК и пишет строки (после seed.sql) одной транзакцией.
 * Сбой на середине — файлы остаются в папках DEMO-ЖК, следующий demo:seed их уберёт.
 */
export async function seedDemoMedia(db) {
  const complexes = await demoComplexIds(db);
  const photos = await uploadPhotos(complexes);
  const drawings = await uploadDrawings(db, complexes);
  const picker = await uploadPicker(db, storageClient(), complexes);
  const progress = await uploadProgress(db, storageClient(), complexes);
  await db.query("begin");
  try {
    // DEMO — не действия сотрудников: в журнал не пишется (только в этой транзакции, как seed.sql).
    await db.query("select set_config('vodiy.skip_audit', 'on', true)");
    await insertMediaRows(db, photos, drawings);
    await insertPickerRows(db, picker);
    await insertProgressRows(db, progress);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  return photos.length + drawings.length + picker.reduce((sum, item) => sum + 1 + item.plans.length, 0) + progressPhotoCount(progress);
}
