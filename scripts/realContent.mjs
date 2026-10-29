// Настоящие ЖК из материалов заказчика (docs/zhk/content.json): `npm run content:import`. Создаёт
// черновиками застройщиков и ЖК, которых ещё нет (по адресу slug), с рендерами как фото галереи и
// фасадом «Выбрать квартиру». Что уже есть — не трогает: руководитель мог дописать и переставить.
// Повторный запуск ничего не дублирует; в облако заказчика на «Запуске» — тем же скриптом.
// Строка подключения — SUPABASE_DB_URL, Storage — NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SECRET_KEY.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import sharp from "sharp";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";

const ZHK_DIR = path.join(import.meta.dirname, "..", "docs", "zhk");
const BUCKET = "media";
// Как кабинет (lib/media/rules.ts): длинная сторона ≤ 3200 px, JPEG; превью ~16 px для заглушки.
const MAX_LONG_SIDE = 3200;
const JPEG_QUALITY = 82;
const BLUR_WIDTH = 16;

const content = JSON.parse(await readFile(path.join(ZHK_DIR, "content.json"), "utf8"));

for (const key of ["SUPABASE_DB_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[key]) {
    console.error(`Нет ${key} в .env.local — см. .env.example.`);
    process.exit(1);
  }
}
const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
}).storage.from(BUCKET);

/** Рендер → JPEG как из кабинета: ≤ 3200 px по длинной стороне, размеры и заглушка. */
async function prepare(file) {
  const raw = await readFile(path.join(ZHK_DIR, file));
  const jpeg = await sharp(raw)
    .rotate()
    .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const { width, height } = await sharp(jpeg).metadata();
  const tiny = await sharp(jpeg).resize({ width: BLUR_WIDTH }).jpeg({ quality: 50 }).toBuffer();
  return { jpeg, width, height, blur: `data:image/jpeg;base64,${tiny.toString("base64")}` };
}

async function upload(complexId, file) {
  const image = await prepare(file);
  const objectPath = `complexes/${complexId}/${crypto.randomUUID()}.jpg`;
  const { error } = await storage.upload(objectPath, image.jpeg, { contentType: "image/jpeg" });
  if (error) throw new Error(`Storage: загрузка ${file}`, { cause: error });
  return { ...image, path: objectPath };
}

const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL));
await client.connect();
const uploaded = [];
try {
  await client.query("begin");
  // Загрузка, не действие сотрудника: в журнал не пишется (только в этой транзакции, как DEMO-сид).
  await client.query("select set_config('vodiy.skip_audit', 'on', true)");
  const developers = new Map();
  let newDevelopers = 0;
  for (const developer of content.developers) {
    const inserted = await client.query(
      `insert into public.developers (slug, name, sort)
       values ($1, $2, (select coalesce(max(d.sort), 0) + 10 from public.developers d))
       on conflict (slug) do nothing returning id`,
      [developer.slug, developer.name],
    );
    newDevelopers += inserted.rowCount;
    const { rows } = await client.query("select id from public.developers where slug = $1", [developer.slug]);
    developers.set(developer.slug, rows[0].id);
  }
  let newComplexes = 0;
  let photos = 0;
  for (const complex of content.complexes) {
    const exists = await client.query("select 1 from public.complexes where slug = $1", [complex.slug]);
    if (exists.rowCount) continue;
    const { rows } = await client.query(
      `insert into public.complexes (developer_id, name, slug, sort)
       values ($1, $2::public.i18n_text, $3, (select coalesce(max(c.sort), 0) + 10 from public.complexes c))
       returning id`,
      [developers.get(complex.developer), JSON.stringify({ ru: complex.name, uz: complex.name }), complex.slug],
    );
    const complexId = rows[0].id;
    newComplexes += 1;
    for (const [sort, file] of complex.photos.entries()) {
      const image = await upload(complexId, file);
      uploaded.push(image.path);
      await client.query(
        `insert into public.media_assets (complex_id, kind, path, width, height, blur, focus_x, focus_y, sort)
         values ($1, 'photo', $2, $3, $4, $5, 0.5, 0.5, $6)`,
        [complexId, image.path, image.width, image.height, image.blur, sort],
      );
      photos += 1;
    }
    if (complex.facade) {
      const image = await upload(complexId, complex.facade);
      uploaded.push(image.path);
      await client.query(
        `insert into public.media_assets (complex_id, kind, path, width, height, blur) values ($1, 'facade', $2, $3, $4, $5)`,
        [complexId, image.path, image.width, image.height, image.blur],
      );
      photos += 1;
    }
  }
  await client.query("commit");
  console.log(`Новых застройщиков: ${newDevelopers}, ЖК: ${newComplexes}, файлов: ${photos}. Всё — черновики; остальное — в кабинете.`);
} catch (error) {
  await client.query("rollback");
  // Строк нет — файлы, загруженные до сбоя, тоже не нужны.
  if (uploaded.length) await storage.remove(uploaded);
  throw error;
} finally {
  await client.end();
}
