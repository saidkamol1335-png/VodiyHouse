// Настоящие ЖК из материалов заказчика (docs/zhk/content.json): `npm run content:import`. Создаёт
// застройщиков и ЖК, которых ещё нет (по адресу slug), и дополняет черновики данными чек-листа: пустые
// поля, новые фото, блоки с планировками и квартирами, детали, документы, программы оплаты, отчёт хода
// строительства. Опубликованные, скрытые и архивные не трогает: их ведёт руководитель, снятое им не
// вернётся. Повторный запуск ничего не дублирует; publish: true — публикует черновик, который ещё не
// публиковали (файлы просмотрены по правилу 1.2, условия публикации проверяет база). В облако заказчика
// на «Запуске» — тем же скриптом.
// Строка подключения — SUPABASE_DB_URL, Storage — NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SECRET_KEY.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import sharp from "sharp";
import { blockLayoutKeys, siteUnitRows } from "../lib/content/units.ts";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";

const ZHK_DIR = path.join(import.meta.dirname, "..", "docs", "zhk");
const BUCKET = "media";
// Как кабинет (lib/media/rules.ts): длинная сторона ≤ 3200 px, JPEG; превью ~16 px для заглушки.
const MAX_LONG_SIDE = 3200;
const LOGO_MAX_LONG_SIDE = 1600;
const JPEG_QUALITY = 82;
const BLUR_WIDTH = 16;

const content = JSON.parse(await readFile(path.join(ZHK_DIR, "content.json"), "utf8"));

for (const key of ["SUPABASE_DB_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[key]) {
    console.error(`Нет ${key} в .env.local — см. .env.example.`);
    process.exit(1);
  }
}
const storage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false },
  },
).storage.from(BUCKET);

const json = (value) => (value == null ? null : JSON.stringify(value));

/** Рендер → JPEG как из кабинета: ≤ 3200 px по длинной стороне, размеры и заглушка. */
async function prepareJpeg(file) {
  const raw = await readFile(path.join(ZHK_DIR, file));
  const jpeg = await sharp(raw)
    .rotate()
    .resize({
      width: MAX_LONG_SIDE,
      height: MAX_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const { width, height } = await sharp(jpeg).metadata();
  const tiny = await sharp(jpeg).resize({ width: BLUR_WIDTH }).jpeg({ quality: 50 }).toBuffer();
  return { body: jpeg, width, height, blur: `data:image/jpeg;base64,${tiny.toString("base64")}` };
}

/** Чертёж — PNG на белом листе, логотип — PNG как есть (lib/media/rules.ts). */
async function preparePng(file, { maxSide = MAX_LONG_SIDE, onWhite = true } = {}) {
  const raw = await readFile(path.join(ZHK_DIR, file));
  let image = sharp(raw).resize({
    width: maxSide,
    height: maxSide,
    fit: "inside",
    withoutEnlargement: true,
  });
  if (onWhite) image = image.flatten({ background: "#ffffff" });
  const body = await image.png({ compressionLevel: 9 }).toBuffer();
  const { width, height } = await sharp(body).metadata();
  return { body, width, height, blur: null };
}

const uploaded = [];
const counts = {
  developers: 0,
  complexes: 0,
  photos: 0,
  blocks: 0,
  layouts: 0,
  units: 0,
  drawings: 0,
  details: 0,
  documents: 0,
  programs: 0,
  reports: 0,
  published: 0,
};

async function store(folder, image, extension) {
  const objectPath = `${folder}/${crypto.randomUUID()}.${extension}`;
  const contentType = extension === "png" ? "image/png" : "image/jpeg";
  const { error } = await storage.upload(objectPath, image.body, { contentType });
  if (error) throw new Error(`Storage: загрузка ${objectPath}`, { cause: error });
  uploaded.push(objectPath);
  return objectPath;
}

const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL));
// Обрыв между запросами: следующий запрос вернёт ошибку и попадёт в откат с уборкой файлов.
client.on("error", () => {});

// Какие фото из content.json уже загружены: удалённое руководителем не вернётся, его фото не мешают.
const PHOTOS_LEDGER_KEY = "content.imported_photos";
let photosLedger = {};

async function importDeveloper(developer) {
  const inserted = await client.query(
    `insert into public.developers (slug, name, sort)
     values ($1, $2, (select coalesce(max(d.sort), 0) + 10 from public.developers d))
     on conflict (slug) do nothing returning id`,
    [developer.slug, developer.name],
  );
  counts.developers += inserted.rowCount;
  const { rows } = await client.query("select id, status from public.developers where slug = $1", [
    developer.slug,
  ]);
  const { id, status } = rows[0];
  if (status !== "draft") return id;
  await client.query(
    `update public.developers set
       about = coalesce(about, $2::jsonb::public.i18n_text),
       founded_year = coalesce(founded_year, $3),
       flats_delivered = coalesce(flats_delivered, $4)
     where id = $1`,
    [id, json(developer.about), developer.foundedYear ?? null, developer.flatsDelivered ?? null],
  );
  if (developer.pastProjects?.length) {
    const past = await client.query(
      "select 1 from public.developer_past_projects where developer_id = $1 limit 1",
      [id],
    );
    if (!past.rowCount) {
      for (const [sort, project] of developer.pastProjects.entries()) {
        await client.query(
          "insert into public.developer_past_projects (developer_id, name, sort) values ($1, $2::jsonb::public.i18n_text, $3)",
          [id, json(project.name), sort + 1],
        );
      }
    }
  }
  if (developer.logo) {
    const logo = await client.query(
      "select 1 from public.media_assets where developer_id = $1 and kind = 'logo'",
      [id],
    );
    if (!logo.rowCount) {
      const image = await preparePng(developer.logo, {
        maxSide: LOGO_MAX_LONG_SIDE,
        onWhite: false,
      });
      const objectPath = await store(`developers/${id}`, image, "png");
      await client.query(
        "insert into public.media_assets (developer_id, kind, path, width, height) values ($1, 'logo', $2, $3, $4)",
        [id, objectPath, image.width, image.height],
      );
      counts.photos += 1;
    }
  }
  return id;
}

async function ensureComplex(complex, developers) {
  const exists = await client.query("select id, status from public.complexes where slug = $1", [
    complex.slug,
  ]);
  if (exists.rowCount) return exists.rows[0];
  const { rows } = await client.query(
    `insert into public.complexes (developer_id, name, slug, sort)
     values ($1, $2::public.i18n_text, $3, (select coalesce(max(c.sort), 0) + 10 from public.complexes c))
     returning id, status`,
    [developers.get(complex.developer), json({ ru: complex.name, uz: complex.name }), complex.slug],
  );
  counts.complexes += 1;
  return rows[0];
}

/** Поля вкладки «Основное»: только пустые, заполненное в кабинете остаётся. */
async function fillMain(id, complex) {
  await client.query(
    `update public.complexes set
       class = coalesce(class, $2::public.complex_class),
       house_type = coalesce(house_type, $3::public.house_type),
       ceiling_height = coalesce(ceiling_height, $4),
       parking = coalesce(parking, $5::public.parking_type),
       location_id = coalesce(location_id, (select l.id from public.locations l where l.slug = $6)),
       address = coalesce(address, $7::jsonb::public.i18n_text),
       landmark = coalesce(landmark, $8::jsonb::public.i18n_text),
       minutes_to_center = coalesce(minutes_to_center, $9),
       lat = coalesce(lat, $10),
       lng = coalesce(lng, $11),
       nearby = case when nearby = '[]'::jsonb then $12::jsonb else nearby end,
       staff_visited_at = coalesce(staff_visited_at, $13::date)
     where id = $1`,
    [
      id,
      complex.class ?? null,
      complex.houseType ?? null,
      complex.ceilingHeight ?? null,
      complex.parking ?? null,
      complex.location ?? null,
      json(complex.address),
      json(complex.landmark),
      complex.minutesToCenter ?? null,
      complex.point?.[0] ?? null,
      complex.point?.[1] ?? null,
      JSON.stringify(complex.nearby ?? []),
      complex.visitedOn ?? null,
    ],
  );
}

/** Фото — только те, что ещё не загружали. Загрузки до журнала шли по порядку списка. */
async function fillPhotos(id, complex) {
  const { rows } = await client.query(
    "select count(*)::int as have, coalesce(max(sort), -1)::int as last from public.media_assets where complex_id = $1 and kind = 'photo'",
    [id],
  );
  let sort = rows[0].last;
  const loaded = photosLedger[complex.slug] ?? complex.photos.slice(0, rows[0].have);
  photosLedger[complex.slug] = loaded;
  for (const file of complex.photos.filter((photo) => !loaded.includes(photo))) {
    loaded.push(file);
    const image = await prepareJpeg(file);
    const objectPath = await store(`complexes/${id}`, image, "jpg");
    sort += 1;
    await client.query(
      `insert into public.media_assets (complex_id, kind, path, width, height, blur, focus_x, focus_y, sort)
       values ($1, 'photo', $2, $3, $4, $5, 0.5, 0.5, $6)`,
      [id, objectPath, image.width, image.height, image.blur, sort],
    );
    counts.photos += 1;
  }
  if (!complex.facade) return;
  const facade = await client.query(
    "select 1 from public.media_assets where complex_id = $1 and kind = 'facade'",
    [id],
  );
  if (facade.rowCount) return;
  const image = await prepareJpeg(complex.facade);
  const objectPath = await store(`complexes/${id}`, image, "jpg");
  await client.query(
    "insert into public.media_assets (complex_id, kind, path, width, height, blur) values ($1, 'facade', $2, $3, $4, $5)",
    [id, objectPath, image.width, image.height, image.blur],
  );
  counts.photos += 1;
}

async function insertLayout(complexId, blockId, layout, sort, drawings) {
  let drawingId = null;
  if (layout.drawing) {
    drawingId = drawings.get(layout.drawing) ?? null;
    if (!drawingId) {
      const image = await preparePng(layout.drawing);
      const objectPath = await store(`complexes/${complexId}`, image, "png");
      const { rows } = await client.query(
        "insert into public.media_assets (complex_id, kind, path, width, height) values ($1, 'drawing', $2, $3, $4) returning id",
        [complexId, objectPath, image.width, image.height],
      );
      drawingId = rows[0].id;
      drawings.set(layout.drawing, drawingId);
      counts.drawings += 1;
    }
  }
  const { rows } = await client.query(
    `insert into public.layouts (block_id, rooms, area, drawing_id, price_from, available, sort)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      blockId,
      layout.rooms,
      layout.area,
      drawingId,
      layout.priceFrom ?? null,
      layout.available ?? true,
      sort,
    ],
  );
  counts.layouts += 1;
  return rows[0].id;
}

async function insertBlock(complexId, block, sort, unitsFile, drawings) {
  const delivered = block.status === "delivered";
  const { rows } = await client.query(
    `insert into public.blocks (
       complex_id, name, build_status, progress_pct, floors_total, floors_built, deadline_year, deadline_quarter,
       finishing_id, cadastre, cadastre_expected_on, price_includes, currency, sort
     )
     values ($1, $2, $3::public.build_status, $4, $5, $6, $7, $8,
       (select f.id from public.finishings f where f.slug = $9), $10::public.cadastre_status, $11::date, $12::jsonb, $13::public.currency, $14)
     returning id`,
    [
      complexId,
      block.name,
      block.status,
      delivered ? null : (block.progressPct ?? null),
      block.floorsTotal,
      delivered ? null : (block.floorsBuilt ?? null),
      block.deadline?.[0] ?? null,
      block.deadline?.[1] ?? null,
      block.finishing ?? null,
      block.cadastre ?? null,
      block.cadastreExpectedOn ?? null,
      JSON.stringify(block.includes ?? []),
      block.currency,
      sort,
    ],
  );
  const blockId = rows[0].id;
  counts.blocks += 1;
  const layoutIds = new Map();
  if (unitsFile) {
    for (const [index, key] of blockLayoutKeys(unitsFile, block.name).entries()) {
      layoutIds.set(
        key,
        await insertLayout(complexId, blockId, unitsFile.layouts[key], index + 1, drawings),
      );
    }
    for (const row of siteUnitRows(unitsFile, block.name)) {
      await client.query(
        `insert into public.units (block_id, layout_id, entrance, floor, position, number, price, price_per_m2, status)
         values ($1, $2, 1, $3, $4, $5, $6, $7, $8::public.unit_status)`,
        [
          blockId,
          row.layout ? layoutIds.get(row.layout) : null,
          row.floor,
          row.position,
          row.number,
          row.price,
          row.pricePerM2,
          row.status,
        ],
      );
      counts.units += 1;
    }
  }
  for (const [index, layout] of (block.layouts ?? []).entries()) {
    await insertLayout(complexId, blockId, layout, index + 1, drawings);
  }
  return blockId;
}

async function insertPrograms(developerId, blockIds, programs) {
  for (const program of programs) {
    await client.query(
      `insert into public.payment_programs (
         developer_id, type, method, discount_pct, tiers, preset_months, allow_custom_months,
         blocks_scope, block_ids, conditions, is_active, sort
       )
       values ($1, $2::public.payment_program_type, $3::public.payment_method, $4, $5::jsonb, $6::smallint[], $7,
         'selected', $8::uuid[], $9::jsonb::public.i18n_text, $10, $11)`,
      [
        developerId,
        program.type,
        program.method ?? null,
        program.discountPct ?? null,
        JSON.stringify(program.tiers ?? []),
        program.presetMonths ?? [],
        program.allowCustomMonths ?? false,
        blockIds,
        json(program.conditions),
        program.active ?? false,
        program.sort ?? 0,
      ],
    );
    counts.programs += 1;
  }
}

/** Блоки, планировки, квартиры и программы — только у ЖК без блоков: иначе их ведёт руководитель. */
async function fillBlocks(id, complex, developers) {
  const { rowCount } = await client.query(
    "select 1 from public.blocks where complex_id = $1 limit 1",
    [id],
  );
  if (rowCount || !complex.blocks?.length) return;
  const unitsFile = complex.units
    ? JSON.parse(await readFile(path.join(ZHK_DIR, complex.units), "utf8"))
    : null;
  const drawings = new Map();
  const blockIds = [];
  for (const [index, block] of complex.blocks.entries()) {
    blockIds.push(await insertBlock(id, block, index + 1, unitsFile, drawings));
  }
  if (complex.programs?.length)
    await insertPrograms(developers.get(complex.developer), blockIds, complex.programs);
}

async function fillContent(id, complex) {
  for (const [topic, text] of Object.entries(complex.details ?? {})) {
    const { rowCount } = await client.query(
      `insert into public.complex_details (complex_id, topic_id, text)
       select $1, t.id, $3::jsonb::public.i18n_text from public.detail_topics t where t.slug = $2
       on conflict (complex_id, topic_id) do nothing`,
      [id, topic, JSON.stringify(text)],
    );
    counts.details += rowCount;
  }
  for (const type of complex.documents?.types ?? []) {
    const { rowCount } = await client.query(
      `insert into public.complex_documents (complex_id, document_type_id, checked_on)
       select $1, t.id, $3::date from public.document_types t where t.slug = $2
       on conflict (complex_id, document_type_id) do nothing`,
      [id, type, complex.documents.checkedOn],
    );
    counts.documents += rowCount;
  }
}

async function fillProgress(id, complex) {
  for (const report of complex.progress ?? []) {
    const { rows } = await client.query(
      "select id from public.blocks where complex_id = $1 and name = $2",
      [id, report.block],
    );
    if (!rows[0]) continue;
    const blockId = rows[0].id;
    const existing = await client.query(
      "select 1 from public.progress_reports where block_id = $1 and month = $2::date and not is_unit",
      [blockId, report.month],
    );
    if (existing.rowCount) continue;
    const inserted = await client.query(
      // Сайт пишет «Снято …» по дате создания: день съёмки из чек-листа, не день загрузки.
      `insert into public.progress_reports (complex_id, block_id, month, comment, status, published_at, created_at)
       values ($1, $2, $3::date, $4::jsonb::public.i18n_text, 'published', $5::date + time '12:00', $5::date + time '12:00') returning id`,
      [id, blockId, report.month, JSON.stringify(report.comment), report.date],
    );
    for (const [index, file] of report.photos.entries()) {
      const image = await prepareJpeg(file);
      const objectPath = await store(`complexes/${id}`, image, "jpg");
      await client.query(
        `insert into public.progress_photos (report_id, complex_id, path, width, height, blur, sort)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [inserted.rows[0].id, id, objectPath, image.width, image.height, image.blur, index + 1],
      );
      counts.photos += 1;
    }
    counts.reports += 1;
  }
}

/** Публикация — та же проверка базы, что у кабинета: не готов — вся загрузка откатывается. */
async function publish(table, id) {
  const { rowCount } = await client.query(
    `update public.${table} set status = 'published', files_checked_at = now()
     where id = $1 and status = 'draft' and files_checked_at is null`,
    [id],
  );
  counts.published += rowCount;
}

await client.connect();
try {
  await client.query("begin");
  // Загрузка, не действие сотрудника: в журнал не пишется (только в этой транзакции, как DEMO-сид).
  await client.query("select set_config('vodiy.skip_audit', 'on', true)");
  const ledger = await client.query("select value from public.settings where key = $1", [
    PHOTOS_LEDGER_KEY,
  ]);
  photosLedger = ledger.rows[0]?.value ?? {};
  const developers = new Map();
  for (const developer of content.developers)
    developers.set(developer.slug, await importDeveloper(developer));
  const ids = new Map();
  for (const complex of content.complexes) {
    const { id, status } = await ensureComplex(complex, developers);
    ids.set(complex.slug, id);
    if (status !== "draft") {
      photosLedger[complex.slug] ??= complex.photos;
      continue;
    }
    await fillMain(id, complex);
    await fillPhotos(id, complex);
    await fillBlocks(id, complex, developers);
    await fillContent(id, complex);
    await fillProgress(id, complex);
  }
  for (const developer of content.developers) {
    if (developer.publish) await publish("developers", developers.get(developer.slug));
  }
  for (const complex of content.complexes) {
    if (complex.publish) await publish("complexes", ids.get(complex.slug));
  }
  await client.query(
    `insert into public.settings (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [PHOTOS_LEDGER_KEY, JSON.stringify(photosLedger)],
  );
  await client.query("commit");
  console.log(
    `Застройщиков: ${counts.developers}, ЖК: ${counts.complexes}, файлов: ${counts.photos + counts.drawings}, блоков: ${counts.blocks}, ` +
      `планировок: ${counts.layouts}, квартир: ${counts.units}, деталей: ${counts.details}, документов: ${counts.documents}, ` +
      `программ: ${counts.programs}, отчётов: ${counts.reports}, опубликовано: ${counts.published}.`,
  );
} catch (error) {
  // Соединение могло оборваться: тогда база откатит сама, а исходная ошибка важнее ошибки отката.
  await client.query("rollback").catch(() => {});
  // Строк нет — файлы, загруженные до сбоя, тоже не нужны.
  if (uploaded.length) await storage.remove(uploaded);
  throw error;
} finally {
  await client.end().catch(() => {});
}
