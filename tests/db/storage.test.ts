import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MEDIA_KINDS, MEDIA_PATH_PATTERN, mediaPath } from "@/lib/media";
import { seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  user,
  type Actor,
  type TestDb,
} from "./harness";

// Шаблон пути переопределён в миграции витрины (3.16а): папки specials / collections / ads.
const STORAGE_MIGRATION = path.resolve(
  import.meta.dirname,
  "../../supabase/migrations/20261028150000_showcase.sql",
);

// Хранилище фото (шаг 9): сайт читает файлы по публичной ссылке, загружает и удаляет только
// руководитель и только в папку существующего ЖК или застройщика (PLAN §5, §3.11).
describe("хранилище фото", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let videographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
  });
  afterAll(() => db.close());

  const complexFile = (complexId: string, ext = "jpg") =>
    `complexes/${complexId}/${crypto.randomUUID()}.${ext}`;

  // Так строку пишет сам Storage при загрузке: от имени пользователя, с его RLS.
  const upload = (actor: Actor, name: string, bucket = "media") =>
    db.as(actor, (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ($1, $2) returning name", [
        bucket,
        name,
      ]),
    );

  it("бакет media публичный, до 15 МБ, только JPEG и PNG", async () => {
    const { rows } = await db.admin.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'media'",
    );
    expect(rows).toEqual([
      {
        public: true,
        file_size_limit: 15 * 1024 * 1024,
        allowed_mime_types: ["image/jpeg", "image/png"],
      },
    ]);
  });

  it("руководитель загружает в папку ЖК и застройщика — по путям из lib/media", async () => {
    await upload(user(head), mediaPath({ type: "complex", id: ids.draftComplex }, "image/jpeg"));
    await upload(
      user(head),
      mediaPath({ type: "developer", id: ids.publicDeveloper }, "image/png"),
    );
  });

  it("код и база согласны: виды файлов и шаблон пути", async () => {
    const { rows } = await db.admin.query<{ kinds: string[] }>(
      "select enum_range(null::public.media_kind)::text[] as kinds",
    );
    expect(rows[0]?.kinds).toEqual([...MEDIA_KINDS]);
    const sql = await readFile(STORAGE_MIGRATION, "utf8");
    expect(sql).toContain(`object_name ~ '${MEDIA_PATH_PATTERN.source.replaceAll("\\/", "/")}'`);
  });

  it("менеджер и посетитель загружать не могут; видеограф — только JPEG в папку ЖК (фото отчётов, фаза 5)", async () => {
    for (const actor of [user(manager), anon]) {
      await expectDenied(upload(actor, complexFile(ids.publicComplex)));
    }
    await upload(user(videographer), complexFile(ids.publicComplex));
    for (const name of [
      complexFile(ids.publicComplex, "png"),
      complexFile(crypto.randomUUID()),
      `developers/${ids.publicDeveloper}/${crypto.randomUUID()}.jpg`,
      `specials/${ids.publicComplex}/${crypto.randomUUID()}.jpg`,
    ]) {
      await expectDenied(upload(user(videographer), name));
    }
  });

  it("видео отчётов: бакет progress-video, только MP4 в папку ЖК — видеограф и руководитель; удаляет руководитель", async () => {
    const { rows } = await db.admin.query(
      "select public, allowed_mime_types from storage.buckets where id = 'progress-video'",
    );
    expect(rows).toEqual([{ public: true, allowed_mime_types: ["video/mp4"] }]);
    const video = (complexId: string, ext = "mp4") => complexFile(complexId, ext);
    await upload(user(videographer), video(ids.publicComplex), "progress-video");
    await upload(user(head), video(ids.draftComplex), "progress-video");
    for (const actor of [user(manager), anon]) {
      await expectDenied(upload(actor, video(ids.publicComplex), "progress-video"));
    }
    for (const name of [video(ids.publicComplex, "mov"), video(crypto.randomUUID()), complexFile(ids.publicComplex)]) {
      await expectDenied(upload(user(videographer), name, "progress-video"));
    }
    // MP4 в бакет фото не попадает: там только картинки.
    await expectDenied(upload(user(videographer), video(ids.publicComplex), "media"));

    const name = video(ids.publicComplex);
    await upload(user(videographer), name, "progress-video");
    const remove = (actor: Actor) =>
      db.as(actor, async (tx) => {
        await tx.query("select set_config('storage.allow_delete_query', 'true', true)");
        return tx.query("delete from storage.objects where bucket_id = 'progress-video' and name = $1", [name]);
      });
    expect((await remove(user(videographer))).affectedRows).toBe(0);
    expect((await remove(user(head))).affectedRows).toBe(1);
  });

  it("путь — только папка существующего владельца, UUID и .jpg / .png", async () => {
    const otherUuid = crypto.randomUUID();
    const bad = [
      complexFile(otherUuid),
      `developers/${otherUuid}/${crypto.randomUUID()}.png`,
      complexFile(ids.publicComplex, "gif"),
      complexFile(ids.publicComplex, "JPG"),
      `complexes/${ids.publicComplex}/cover.jpg`,
      `complexes/${ids.publicComplex}/extra/${crypto.randomUUID()}.jpg`,
      `blocks/${ids.publicComplex}/${crypto.randomUUID()}.jpg`,
      `${crypto.randomUUID()}.jpg`,
    ];
    for (const name of bad) await expectDenied(upload(user(head), name));
  });

  it("в чужой бакет руководитель через эти политики не пишет", async () => {
    await db.admin.query("insert into storage.buckets (id, name) values ('other', 'other')");
    await expectDenied(upload(user(head), complexFile(ids.publicComplex), "other"));
  });

  it("список файлов видят сотрудники, посетитель — нет (ему хватает публичной ссылки)", async () => {
    const name = complexFile(ids.publicComplex);
    await upload(user(head), name);
    const visible = (actor: Actor) =>
      db.as(actor, (tx) => tx.query("select name from storage.objects where name = $1", [name]));
    expect((await visible(anon)).rows).toEqual([]);
    for (const id of [head, manager, videographer]) {
      expect((await visible(user(id))).rows).toEqual([{ name }]);
    }
  });

  it("удаляет файл только руководитель", async () => {
    const name = complexFile(ids.publicComplex);
    await upload(user(head), name);
    const remove = (actor: Actor) =>
      db.as(actor, async (tx) => {
        // Так удаляет сервис Storage: в облаке прямое удаление строк без флага запрещено.
        await tx.query("select set_config('storage.allow_delete_query', 'true', true)");
        return tx.query("delete from storage.objects where name = $1", [name]);
      });
    expect((await remove(user(manager))).affectedRows).toBe(0);
    expect((await remove(user(head))).affectedRows).toBe(1);
  });

  it("запись media_assets указывает только на файл из папки своего владельца", async () => {
    const insertPhoto = (complexId: string, path: string) =>
      db.as(user(head), (tx) =>
        tx.query(
          "insert into media_assets (complex_id, kind, path, width, height) values ($1, 'photo', $2, 3200, 2133)",
          [complexId, path],
        ),
      );
    await insertPhoto(ids.draftComplex, complexFile(ids.draftComplex));
    await expect(insertPhoto(ids.draftComplex, complexFile(ids.publicComplex))).rejects.toThrow(
      /media_assets_path_in_owner_folder/,
    );
    await expect(
      db.as(user(head), (tx) =>
        tx.query(
          "insert into media_assets (developer_id, kind, path, width, height) values ($1, 'logo', $2, 800, 800)",
          [ids.publicDeveloper, `developers/${ids.publicDeveloper}/${crypto.randomUUID()}.png`],
        ),
      ),
    ).resolves.toBeDefined();
  });
});
