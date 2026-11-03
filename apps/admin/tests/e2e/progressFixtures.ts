import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import sharp from "sharp";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { assertE2eProject, e2eStaff, E2E_EMAIL } from "./cloud";

// Отчёты мобилографа на e2e (фаза E): файлы для формы (JPEG от 1600 px — как требует MEDIA_LIMITS.photo,
// MP4-заглушка для TUS), отчёты-заготовки секретным ключом и уборка отчётов E2E-персон с их файлами
// в incoming / media / progress-video. Комментарий RU отчётов e2e начинается с «E2E ·» — по нему уборка
// находит и отчёты упавших прогонов, чьи авторы уже удалены (author_id → null).

export const E2E_COMMENT = "E2E ·";

const INCOMING = "incoming";
const MEDIA = "media";
const PROGRESS_VIDEO = "progress-video";
const INCOMING_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|mp4)$/;
const PUBLIC_PHOTO = /^complexes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
const PUBLIC_VIDEO = /^complexes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/;

export const hasDb = () => Boolean(process.env.SUPABASE_DB_URL);

/** Сегодня по Ташкенту, «2026-11-03» (окно даты съёмки считает сервер так же). */
export function tashkentToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(now);
}

/** «2026-11-03» ± дни. */
export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** «2026-11-03» → «03.11.2026» (formatDate кабинета и сайта). */
export const ruDate = (day: string) => day.split("-").reverse().join(".");

/** Дата съёмки в текущем месяце, но не сегодня (если можно): видно, что «снято» — не дата отправки. */
export function shotDayThisMonth(): string {
  const today = tashkentToday();
  return today.endsWith("-01") ? today : shiftDay(today, -1);
}

// ─── Файлы ────────────────────────────────────────────────────────────────────────────────────

let colorSeed = 0;

/** Настоящий JPEG (sharp): фото отчёта проходит processImage, только если длинная сторона ≥ 1600. */
export async function jpegBuffer(width = 1800, height = 1200): Promise<Buffer> {
  colorSeed += 1;
  const shade = (colorSeed * 47) % 200;
  return sharp({
    create: { width, height, channels: 3, background: { r: 40 + shade, g: 120, b: 220 - shade } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export type UploadFile = { name: string; mimeType: string; buffer: Buffer };

export async function photoFiles(count: number, prefix = "stroyka"): Promise<UploadFile[]> {
  return Promise.all(
    Array.from({ length: count }, async (_, index) => ({
      name: `${prefix}-${index + 1}.jpg`,
      mimeType: "image/jpeg",
      buffer: await jpegBuffer(),
    })),
  );
}

/**
 * MP4-заглушка ~200 КБ: коробка ftyp (isom) и mdat с нулями. Хранилище и форма смотрят только на тип
 * и имя; плеером её не открывают.
 */
export function videoFile(sizeKb = 200): UploadFile {
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31,
  ]);
  const body = sizeKb * 1024 - ftyp.length;
  const mdat = Buffer.alloc(body);
  mdat.writeUInt32BE(body, 0);
  mdat.write("mdat", 4, "latin1");
  return { name: "stroyka.mp4", mimeType: "video/mp4", buffer: Buffer.concat([ftyp, mdat]) };
}

// ─── База и хранилище ─────────────────────────────────────────────────────────────────────────

export async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function adminClient(): SupabaseClient {
  const { url, secret } = assertE2eProject();
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type ComplexInfo = {
  id: string;
  slug: string;
  name: string;
  blocks: { id: string; name: string }[];
};

/** DEMO-ЖК по slug: id, имя RU и строящиеся блоки по порядку формы. */
export async function complexBySlug(slug: string): Promise<ComplexInfo> {
  return withDb(async (client) => {
    const { rows } = await client.query<ComplexInfo>(
      `select c.id, c.slug, c.name ->> 'ru' as name,
              coalesce((select json_agg(json_build_object('id', b.id, 'name', b.name) order by b.sort, b.name)
                        from public.blocks b where b.complex_id = c.id and b.build_status = 'building'), '[]') as blocks
       from public.complexes c where c.slug = $1`,
      [slug],
    );
    if (!rows[0]) throw new Error(`нет ЖК ${slug}`);
    return rows[0];
  });
}

export type ReportRow = {
  id: string;
  status: string;
  shot_on: string;
  month: string;
  author_id: string | null;
  return_note: string | null;
  comment: { ru: string; uz: string };
  video_path: string | null;
  video_publish_path: string | null;
  photos: { path: string; publish_path: string | null; sort: number }[];
};

const REPORT_SELECT = `select r.id, r.status::text, r.shot_on::text, r.month::text, r.author_id, r.return_note, r.comment,
  r.video_path, r.video_publish_path,
  coalesce((select json_agg(json_build_object('path', p.path, 'publish_path', p.publish_path, 'sort', p.sort) order by p.sort)
            from public.progress_photos p where p.report_id = r.id), '[]') as photos
  from public.progress_reports r`;

export async function reportById(id: string): Promise<ReportRow | null> {
  return withDb(
    async (client) =>
      (await client.query<ReportRow>(`${REPORT_SELECT} where r.id = $1`, [id])).rows[0] ?? null,
  );
}

/** Отчёты автора по ЖК, новые сверху. */
export async function reportsOf(authorId: string, complexId: string): Promise<ReportRow[]> {
  return withDb(
    async (client) =>
      (
        await client.query<ReportRow>(
          `${REPORT_SELECT} where r.author_id = $1 and r.complex_id = $2 order by r.created_at desc`,
          [authorId, complexId],
        )
      ).rows,
  );
}

/** Какие из имён лежат в бакете. */
export async function storedObjects(bucket: string, names: readonly string[]): Promise<string[]> {
  if (names.length === 0) return [];
  return withDb(async (client) =>
    (
      await client.query<{ name: string }>(
        "select name from storage.objects where bucket_id = $1 and name = any($2::text[])",
        [bucket, names],
      )
    ).rows.map((row) => row.name),
  );
}

/** Файлы incoming в папке автора и ЖК (что форма загрузила). */
export async function incomingOf(authorId: string, complexId: string): Promise<string[]> {
  return withDb(async (client) =>
    (
      await client.query<{ name: string }>(
        "select name from storage.objects where bucket_id = 'incoming' and name like $1 order by created_at",
        [`${authorId}/${complexId}/%`],
      )
    ).rows.map((row) => row.name),
  );
}

type SeedPersona = "mobilographer" | "head";

export type SeedReport = {
  author?: SeedPersona;
  slug: string;
  /** Имя блока; по умолчанию — первый строящийся. */
  block?: string;
  status: "draft" | "review" | "returned";
  photos: number;
  shotOn?: string;
  comment?: { ru: string; uz: string };
  returnNote?: string;
};

/**
 * Отчёт-заготовка: JPEG секретным ключом в incoming/<автор>/<ЖК>/<uuid>.jpg и строки отчёта владельцем
 * базы (без журнала) — как будто мобилограф сохранил его формой. Возвращает id.
 */
export async function seedReport(spec: SeedReport): Promise<string> {
  const author = e2eStaff()[spec.author ?? "mobilographer"].id;
  const complex = await complexBySlug(spec.slug);
  const block = spec.block
    ? complex.blocks.find((item) => item.name === spec.block)
    : complex.blocks[0];
  if (!block) throw new Error(`нет строящегося блока ${spec.block ?? ""} у ${spec.slug}`);
  const storage = adminClient().storage.from(INCOMING);
  const paths: string[] = [];
  for (let index = 0; index < spec.photos; index += 1) {
    const path = `${author}/${complex.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await storage.upload(path, await jpegBuffer(1600, 1200), {
      contentType: "image/jpeg",
    });
    if (error) throw new Error(`incoming: ${error.message}`);
    paths.push(path);
  }
  const shotOn = spec.shotOn ?? tashkentToday();
  const comment = spec.comment ?? {
    ru: `${E2E_COMMENT} заготовка`,
    uz: `${E2E_COMMENT} tayyorlov`,
  };
  return withDb(async (client) => {
    await client.query("begin");
    try {
      await client.query("select set_config('vodiy.skip_audit', 'on', true)");
      const { rows } = await client.query<{ id: string }>(
        `insert into public.progress_reports (complex_id, block_id, month, shot_on, comment, status, return_note, author_id)
         values ($1, $2, date_trunc('month', $3::date)::date, $3::date, $4::jsonb, $5::public.progress_status, $6, $7)
         returning id`,
        [
          complex.id,
          block.id,
          shotOn,
          JSON.stringify(comment),
          spec.status,
          spec.status === "returned" ? (spec.returnNote ?? `${E2E_COMMENT} причина`) : null,
          author,
        ],
      );
      const id = rows[0]!.id;
      for (const [index, path] of paths.entries()) {
        await client.query(
          "insert into public.progress_photos (report_id, complex_id, path, width, height, sort) values ($1, $2, $3, 1600, 1200, $4)",
          [id, complex.id, path, index + 1],
        );
      }
      await client.query("commit");
      return id;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

/** Файлы по бакетам: incoming — загрузки, media / progress-video — копии публикации. */
function byBucket(paths: Iterable<string | null>): Map<string, string[]> {
  const buckets = new Map<string, string[]>([
    [INCOMING, []],
    [MEDIA, []],
    [PROGRESS_VIDEO, []],
  ]);
  for (const path of new Set(paths)) {
    if (!path) continue;
    if (INCOMING_PATH.test(path)) buckets.get(INCOMING)!.push(path);
    else if (PUBLIC_PHOTO.test(path)) buckets.get(MEDIA)!.push(path);
    else if (PUBLIC_VIDEO.test(path)) buckets.get(PROGRESS_VIDEO)!.push(path);
  }
  return buckets;
}

/**
 * Уборка отчётов e2e: авторы — сотрудники e2e-…@example.com (живые на момент уборки) или комментарий
 * «E2E ·…»; строки — владельцем базы без журнала, файлы — секретным ключом (incoming, media,
 * progress-video), и ещё все загрузки incoming в папках e2e-авторов. complexIds — только эти ЖК
 * (уборка своей спеки, не мешая соседним).
 */
export async function removeE2eProgress(
  options: { complexIds?: readonly string[] } = {},
): Promise<number> {
  if (!hasDb()) return 0;
  const only = options.complexIds ?? null;
  const { paths, removed } = await withDb(async (client) => {
    const authors = (
      await client.query<{ id: string }>("select id from auth.users where email ~ $1", [
        E2E_EMAIL.source,
      ])
    ).rows.map((row) => row.id);
    await client.query("begin");
    try {
      await client.query("select set_config('vodiy.skip_audit', 'on', true)");
      const doomed = (
        await client.query<{ id: string }>(
          `select id from public.progress_reports
           where (author_id = any($1::uuid[]) or comment ->> 'ru' like $2)
             and ($3::uuid[] is null or complex_id = any($3::uuid[]))`,
          [authors, `${E2E_COMMENT}%`, only],
        )
      ).rows.map((row) => row.id);
      const files = (
        await client.query<{ path: string | null }>(
          `select unnest(array[p.path, p.publish_path]) as path from public.progress_photos p where p.report_id = any($1::uuid[])
           union all
           select unnest(array[r.video_path, r.video_publish_path]) from public.progress_reports r where r.id = any($1::uuid[])`,
          [doomed],
        )
      ).rows.map((row) => row.path);
      await client.query("delete from public.progress_reports where id = any($1::uuid[])", [
        doomed,
      ]);
      await client.query("commit");
      const uploads = (
        await client.query<{ name: string }>(
          `select name from storage.objects where bucket_id = 'incoming'
             and split_part(name, '/', 1) = any($1::text[])
             and ($2::text[] is null or split_part(name, '/', 2) = any($2::text[]))`,
          [authors, only],
        )
      ).rows.map((row) => row.name);
      return { paths: [...files, ...uploads], removed: doomed.length };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
  const storage = adminClient().storage;
  for (const [bucket, names] of byBucket(paths)) {
    for (let start = 0; start < names.length; start += 100) {
      const { error } = await storage.from(bucket).remove(names.slice(start, start + 100));
      if (error) console.warn(`[e2e] ${bucket}: файлы не удалены — ${error.message}`);
    }
  }
  return removed;
}
