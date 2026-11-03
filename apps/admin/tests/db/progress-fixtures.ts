import type { ContentIds } from "./content-fixtures";
import { user, type Db, type TestDb } from "./harness";

// Фаза E: общие помощники тестов отчётов — загрузка в incoming (строка storage.objects, как после
// загрузки в облаке), тело отчёта с датой съёмки, публикация в два шага с «копией» сервера.

export type Saved = {
  id: string;
  complex_id: string;
  status: string;
  removed: string[];
  notice: Record<string, unknown>;
};

export type Published = {
  id: string;
  complex_id: string;
  author_id: string;
  incoming: string[];
  notice: Record<string, unknown>;
};

export type Dates = {
  today: string;
  tomorrow: string;
  month: string;
  /** Последний день прошлого месяца — всегда в окне 60 дней. */
  prev: string;
  prevMonth: string;
  d60: string;
  d61: string;
};

export async function tashkentDates(db: TestDb): Promise<Dates> {
  const { rows } = await db.admin.query<Dates>(
    `select to_char(t, 'YYYY-MM-DD') as today,
            to_char(t + 1, 'YYYY-MM-DD') as tomorrow,
            to_char(date_trunc('month', t), 'YYYY-MM-DD') as month,
            to_char(date_trunc('month', t) - interval '1 day', 'YYYY-MM-DD') as prev,
            to_char(date_trunc('month', t) - interval '1 month', 'YYYY-MM-DD') as "prevMonth",
            to_char(t - 60, 'YYYY-MM-DD') as d60,
            to_char(t - 61, 'YYYY-MM-DD') as d61
       from private.tashkent_today() as t`,
  );
  return rows[0]!;
}

type Upload = {
  complex?: string;
  ext?: "jpg" | "mp4";
  mimetype?: string;
  size?: number;
  /** Возраст файла, интервал Postgres: «25 hours». */
  age?: string;
};

export function progressKit(db: TestDb, ids: ContentIds, dates: Dates) {
  const call = <T>(actor: string, sql: string, params: unknown[] = []) =>
    db
      .as(user(actor), (tx: Db) => tx.query<{ r: T }>(`select ${sql} as r`, params))
      .then((result) => result.rows[0]!.r);

  const upload = async (actor: string, options: Upload = {}) => {
    const ext = options.ext ?? "jpg";
    const name = `${actor}/${options.complex ?? ids.publicComplex}/${crypto.randomUUID()}.${ext}`;
    await db.admin.query(
      `insert into storage.objects (bucket_id, name, owner, metadata, created_at)
       values ('incoming', $1, $2, $3, now() - $4::interval)`,
      [
        name,
        actor,
        JSON.stringify({
          mimetype: options.mimetype ?? (ext === "jpg" ? "image/jpeg" : "video/mp4"),
          size: options.size ?? 200_000,
        }),
        options.age ?? "0 seconds",
      ],
    );
    return name;
  };

  const photo = async (actor: string, complex?: string) => ({
    path: await upload(actor, { complex }),
    width: 1600,
    height: 1200,
  });
  // По одному: облачный прогон не пускает параллельные запросы в одной транзакции.
  const photos = async (actor: string, n: number, complex?: string) => {
    const list = [];
    for (let i = 0; i < n; i += 1) list.push(await photo(actor, complex));
    return list;
  };

  /** Тело отчёта: блок публичного ЖК, снято сегодня, 3 свежих фото автора (если не заданы). */
  const report = async (actor: string, patch: Record<string, unknown> = {}) => ({
    block_id: ids.publicBlock,
    shot_on: dates.today,
    comment: { ru: "Залит 9-й этаж", uz: "9-qavat quyildi" },
    photos: "photos" in patch ? patch.photos : await photos(actor, 3),
    ...patch,
  });

  const submit = (actor: string, body: Record<string, unknown>) =>
    call<Saved>(actor, "public.submit_progress_report($1)", [JSON.stringify(body)]);
  const draft = (actor: string, body: Record<string, unknown>) =>
    call<Saved>(actor, "public.save_progress_draft($1)", [JSON.stringify(body)]);

  const version = async (id: string) =>
    (
      await db.admin.query<{ v: string }>("select updated_at::text as v from progress_reports where id = $1", [id])
    ).rows[0]?.v ?? null;

  type Files = { version: string; files: { from: string; to: string; bucket: string }[] };
  const publishFiles = async (actor: string, id: string, checked = true, at?: string | null) =>
    call<Files>(actor, "public.progress_publish_files($1, $2, $3)", [
      id,
      checked,
      at === undefined ? await version(id) : at,
    ]);
  /** Копия сервера секретным ключом — строка в публичном бакете. */
  const copy = async (files: Files["files"]) => {
    for (const file of files) {
      await db.admin.query(
        "insert into storage.objects (bucket_id, name, metadata) values ($1, $2, '{}') on conflict do nothing",
        [file.bucket, file.to],
      );
    }
  };
  const publish = async (actor: string, id: string, checked = true) => {
    const files = await publishFiles(actor, id, checked);
    await copy(files.files);
    return call<Published>(actor, "public.publish_progress_report($1, $2, $3)", [id, checked, files.version]);
  };

  const status = async (id: string) =>
    (await db.admin.query<{ status: string }>("select status from progress_reports where id = $1", [id])).rows[0]
      ?.status;
  const paths = async (id: string) =>
    (
      await db.admin.query<{ path: string }>(
        "select path from progress_photos where report_id = $1 order by sort",
        [id],
      )
    ).rows.map((row) => row.path);
  const storedPhotos = async (id: string) =>
    (
      await db.admin.query<{ path: string; width: number; height: number }>(
        "select path, width, height from progress_photos where report_id = $1 order by sort",
        [id],
      )
    ).rows;

  return {
    call,
    upload,
    photo,
    photos,
    report,
    submit,
    draft,
    version,
    publishFiles,
    copy,
    publish,
    status,
    paths,
    storedPhotos,
  };
}
