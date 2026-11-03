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
  "../../../../supabase/migrations/20261028150000_showcase.sql",
);

// Хранилище фото (шаг 9): сайт читает файлы по публичной ссылке, загружает и удаляет только
// руководитель и только в папку существующего ЖК или застройщика (PLAN §5, §3.11).
describe("хранилище фото", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let mobilographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    mobilographer = await createStaff(db.admin, "mobilographer");
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

  // Проект-2 (PLAN §10, п. 6): менеджер загружает фото ЖК, но не застройщика.
  // Фаза E (п. 13): фото отчётов мобилограф грузит в приватный incoming, в media их копирует сервер.
  it("посетитель загружать не может; менеджер — фото ЖК; мобилограф в media — ничего", async () => {
    await expectDenied(upload(anon, complexFile(ids.publicComplex)));
    await upload(user(manager), complexFile(ids.publicComplex));
    await expectDenied(upload(user(manager), `developers/${ids.publicDeveloper}/${crypto.randomUUID()}.jpg`));
    for (const name of [
      complexFile(ids.publicComplex),
      complexFile(ids.publicComplex, "png"),
      complexFile(crypto.randomUUID()),
      `developers/${ids.publicDeveloper}/${crypto.randomUUID()}.jpg`,
      `specials/${ids.publicComplex}/${crypto.randomUUID()}.jpg`,
    ]) {
      await expectDenied(upload(user(mobilographer), name));
    }
  });

  it("видео отчётов: бакет progress-video, только MP4, до 50 МБ; пишет только сервер, удаляет руководитель", async () => {
    const { rows } = await db.admin.query(
      "select public, allowed_mime_types, file_size_limit::int as limit from storage.buckets where id in ('progress-video', 'incoming') order by id",
    );
    expect(rows).toEqual([
      { public: false, allowed_mime_types: ["image/jpeg", "video/mp4"], limit: 52428800 },
      { public: true, allowed_mime_types: ["video/mp4"], limit: 52428800 },
    ]);
    const video = (complexId: string, ext = "mp4") => complexFile(complexId, ext);
    for (const actor of [user(mobilographer), user(head), user(manager), anon]) {
      await expectDenied(upload(actor, video(ids.publicComplex), "progress-video"));
    }
    // MP4 в бакет фото не попадает: там только картинки.
    await expectDenied(upload(user(mobilographer), video(ids.publicComplex), "media"));

    const name = video(ids.publicComplex);
    await db.admin.query("insert into storage.objects (bucket_id, name) values ('progress-video', $1)", [name]);
    const remove = (actor: Actor) =>
      db.as(actor, async (tx) => {
        await tx.query("select set_config('storage.allow_delete_query', 'true', true)");
        return tx.query("delete from storage.objects where bucket_id = 'progress-video' and name = $1", [name]);
      });
    expect((await remove(user(mobilographer))).affectedRows).toBe(0);
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
    for (const id of [head, manager, mobilographer]) {
      expect((await visible(user(id))).rows).toEqual([{ name }]);
    }
  });

  it("файл фото удаляет руководитель; менеджер — только сироту без строки фото; мобилограф — нет", async () => {
    const remove = (actor: Actor, name: string) =>
      db.as(actor, async (tx) => {
        // Так удаляет сервис Storage: в облаке прямое удаление строк без флага запрещено.
        await tx.query("select set_config('storage.allow_delete_query', 'true', true)");
        return tx.query("delete from storage.objects where name = $1", [name]);
      });
    const used = complexFile(ids.publicComplex);
    await upload(user(head), used);
    await db.admin.query(
      "insert into media_assets (complex_id, kind, path, width, height) values ($1, 'photo', $2, 1600, 1000)",
      [ids.publicComplex, used],
    );
    expect((await remove(user(manager), used)).affectedRows).toBe(0);
    expect((await remove(user(mobilographer), used)).affectedRows).toBe(0);
    expect((await remove(user(head), used)).affectedRows).toBe(1);
    await db.admin.query("delete from media_assets where path = $1", [used]);

    const orphan = complexFile(ids.publicComplex);
    await upload(user(manager), orphan);
    // Владельца файла ставит сервис Storage; заглушка — нет: ставим как он.
    await db.admin.query("update storage.objects set owner = $1 where name = $2", [manager, orphan]);
    const foreign = complexFile(ids.publicComplex);
    await upload(user(head), foreign);
    await db.admin.query("update storage.objects set owner = $1 where name = $2", [head, foreign]);
    expect((await remove(user(manager), foreign)).affectedRows).toBe(0);
    expect((await remove(user(mobilographer), orphan)).affectedRows).toBe(0);
    expect((await remove(user(manager), orphan)).affectedRows).toBe(1);
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
