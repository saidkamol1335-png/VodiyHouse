import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  isRemoteTarget,
  user,
  type TestDb,
} from "./harness";

// Отзывы покупателей (миграция 20261103210000_reviews.sql; PLAN §10, п. 47): опубликовать без
// согласия нельзя; посетитель читает только site_reviews() — опубликованные с согласием и только
// когда их не меньше трёх; правит руководитель, менеджер только читает.

type SiteReview = {
  author_name: string;
  rating: number;
  accent: unknown;
  photo: unknown;
  complex: unknown;
};

const row = (name: string, extra = "") =>
  `insert into reviews (author_name, author_role, rating, quote, accent, is_published, consent_at${extra ? ", sort" : ""})
   values ('${name}', '{"ru":"купил 2-комн.","uz":"2 xonali oldi"}', 4.5,
           '{"ru":"Ключи выдали вовремя","uz":"Kalitni vaqtida berishdi"}',
           '{"ru":"вовремя","uz":"vaqtida"}', true, now()${extra ? `, ${extra}` : ""})`;

describe.skipIf(isRemoteTarget)("отзывы: таблица reviews и site_reviews()", () => {
  let db: TestDb;
  const site = async () =>
    (await db.as(anon, (tx) => tx.query<{ data: SiteReview[] }>("select site_reviews() as data")))
      .rows[0]!.data;

  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(() => db.close());

  it("без согласия опубликовать нельзя; оценка — шаг 0,5; выделенная фраза — из цитаты", async () => {
    await expect(
      db.admin.query(`insert into reviews (author_name, author_role, rating, quote, is_published)
        values ('Анна', '{"ru":"а","uz":"a"}', 5, '{"ru":"Хорошо","uz":"Yaxshi"}', true)`),
    ).rejects.toThrow();
    await expect(
      db.admin.query(`insert into reviews (author_name, author_role, rating, quote)
        values ('Анна', '{"ru":"а","uz":"a"}', 4.3, '{"ru":"Хорошо","uz":"Yaxshi"}')`),
    ).rejects.toThrow();
    await expect(
      db.admin.query(`insert into reviews (author_name, author_role, rating, quote, accent)
        values ('Анна', '{"ru":"а","uz":"a"}', 4, '{"ru":"Хорошо","uz":"Yaxshi"}', '{"ru":"плохо","uz":"yomon"}')`),
    ).rejects.toThrow();
  });

  it("меньше трёх опубликованных с согласием — пусто; три — все три по порядку", async () => {
    await db.admin.query(row("Первый", "2"));
    await db.admin.query(row("Второй", "1"));
    // Черновик без согласия на сайт не идёт и в счёт не входит.
    await db.admin.query(`insert into reviews (author_name, author_role, rating, quote)
      values ('Черновик', '{"ru":"а","uz":"a"}', 5, '{"ru":"Текст","uz":"Matn"}')`);
    expect(await site()).toEqual([]);
    await db.admin.query(row("Третий", "3"));
    const data = await site();
    expect(data.map((review) => review.author_name)).toEqual(["Второй", "Первый", "Третий"]);
    expect(data[0]).toMatchObject({ rating: 4.5, photo: null, complex: null });
  });

  it("посетитель и мобилограф не читают; фото — только reviews/…; менеджер читает, но не правит; руководитель правит", async () => {
    await expectDenied(db.as(anon, (tx) => tx.query("select * from reviews")));
    const mobilographer = await createStaff(db.admin, "mobilographer");
    const hidden = await db.as(user(mobilographer), (tx) => tx.query("select id from reviews"));
    expect(hidden.rows).toEqual([]);
    await expect(
      db.admin
        .query(`insert into reviews (author_name, author_role, rating, quote, photo_path, photo_width, photo_height)
        values ('Фото', '{"ru":"а","uz":"a"}', 5, '{"ru":"Текст","uz":"Matn"}', 'complexes/x.jpg', 10, 10)`),
    ).rejects.toThrow();
    const manager = await createStaff(db.admin, "manager");
    const head = await createStaff(db.admin, "head");
    const seen = await db.as(user(manager), (tx) => tx.query("select id from reviews"));
    expect(seen.rows.length).toBe(4);
    const managerUpdate = await db.as(user(manager), (tx) =>
      tx.query("update reviews set sort = 9 returning id"),
    );
    expect(managerUpdate.rows).toEqual([]);
    const headUpdate = await db.as(user(head, undefined, "aal2"), (tx) =>
      tx.query("update reviews set sort = sort returning id"),
    );
    expect(headUpdate.rows.length).toBe(4);
  });
});
