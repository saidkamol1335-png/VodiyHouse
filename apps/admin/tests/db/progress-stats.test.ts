import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, expectDenied, expectHint, type TestDb } from "./harness";
import { progressKit, tashkentDates, type Dates } from "./progress-fixtures";

// Фаза F, п. 41: «Ход стройки» в статистике руководителя (public.progress_stats). История — из журнала:
// время переходов сценария переносится на свой день, и период этого дня видит только его решения.

type Missing = { id: string; name: string; state: "none" | "returned" };
type Stats = {
  month: string;
  month_open: boolean;
  published: number;
  returned: number;
  returned_reports: number;
  unit_published: number;
  unit_returned: number;
  wait_count: number;
  wait_avg_hours: number | null;
  wait_max_hours: number | null;
  waiting_now: number;
  oldest_wait_hours: number | null;
  complexes_building: number;
  complexes_without: {
    id: string;
    name: { ru: string; uz: string };
    status: string;
    blocks_total: number;
    blocks_done: number;
    missing: Missing[];
    last_published_at: string | null;
    late: boolean;
  }[];
};

describe.skipIf(process.env.DB_TEST_TARGET === "remote")(
  "«Ход стройки» в статистике (фаза F)",
  () => {
    let db: TestDb;
    let ids: ContentIds;
    let dates: Dates;
    let kit: ReturnType<typeof progressKit>;
    let head: string;
    let manager: string;
    let video: string;
    let day10: string;
    let day20: string;

    beforeAll(async () => {
      db = await createTestDb();
      ids = await seedContent(db.admin);
      head = await createStaff(db.admin, "head");
      manager = await createStaff(db.admin, "manager");
      video = await createStaff(db.admin, "mobilographer");
      dates = await tashkentDates(db);
      kit = progressKit(db, ids, dates);
      const { rows } = await db.admin.query<{ d10: string; d20: string }>(
        `select (private.tashkent_today() - 10)::text as d10, (private.tashkent_today() - 20)::text as d20`,
      );
      day10 = rows[0]!.d10;
      day20 = rows[0]!.d20;
    });
    afterAll(() => db.close());

    const stats = (from: string, to: string, actor = head) =>
      kit.call<Stats>(actor, "public.progress_stats($1::date, $2::date)", [from, to]);

    /** Переходы статуса отчёта (по порядку, без удаления) — на день `day`, часы от полуночи по Ташкенту. */
    const retime = async (id: string, day: string, hours: number[]) => {
      const { rows } = await db.admin.query<{ id: string }>(
        `select id::text from public.audit_log
        where entity = 'progress_reports' and entity_id = $1 and action <> 'delete' and changes ? 'status'
        order by id`,
        [id],
      );
      expect(rows).toHaveLength(hours.length);
      for (const [index, row] of rows.entries())
        await db.admin.query(
          `update public.audit_log
            set at = ($2::date::timestamp at time zone 'Asia/Tashkent') + $3::numeric * interval '1 hour'
          where id = $1::bigint`,
          [row.id, day, hours[index]],
        );
    };
    const returnReport = (id: string, note: string) =>
      kit.call(head, "public.return_progress_report($1, $2)", [id, note]);
    const block = async (name: string, complex = ids.publicComplex, status = "building") =>
      (
        await db.admin.query<{ id: string }>(
          "insert into public.blocks (complex_id, name, build_status) values ($1, $2, $3) returning id",
          [complex, name, status],
        )
      ).rows[0]!.id;

    it("только руководитель; период — как у статистики сайта", async () => {
      await expectHint(stats(dates.today, dates.today, manager), "vh:forbidden");
      await expectHint(stats(dates.today, dates.today, video), "vh:forbidden");
      await expectDenied(
        db.as(anon, (tx) => tx.query("select public.progress_stats(current_date, current_date)")),
      );
      await expectHint(stats(dates.today, dates.tomorrow), "vh:invalid");
      await expectHint(stats(dates.today, day10), "vh:invalid");
    });

    it("возврат и повторная отправка: опубликован 1, возвратов 1, ожидание — от последней отправки", async () => {
      const { id } = await kit.submit(video, await kit.report(video));
      await returnReport(id, "Переснять двор");
      await kit.submit(video, await kit.report(video, { id }));
      await kit.publish(head, id);
      // Отправка 9:00 → возврат 11:00 (2 ч) → снова 14:00 → публикация 17:00 (3 ч).
      await retime(id, day10, [9, 11, 14, 17]);
      // Видео квартиры: отдельный счёт, ожидание общее (1 ч).
      const unit = await kit.submit(video, await kit.report(video, { unit_id: ids.units[0] }));
      await kit.publish(head, unit.id);
      await retime(unit.id, day10, [10, 11]);

      const result = await stats(day10, day10);
      expect(result).toMatchObject({
        published: 1,
        returned: 1,
        returned_reports: 1,
        unit_published: 1,
        unit_returned: 0,
        wait_count: 3,
        wait_avg_hours: 2,
        wait_max_hours: 3,
      });
      // Соседний день — пусто: решения считаются по времени решения.
      expect(await stats(day20, day20)).toMatchObject({
        published: 0,
        returned: 0,
        wait_count: 0,
        wait_avg_hours: null,
      });
    });

    it("снят и опубликован снова — один отчёт и одно ожидание; удалённый после публикации — в счёте", async () => {
      const { id } = await kit.submit(video, await kit.report(video, { shot_on: dates.prev }));
      await kit.publish(head, id);
      await kit.call(head, "public.unpublish_progress_report($1)", [id]);
      await kit.publish(head, id);
      await kit.call(head, "public.delete_progress_report($1)", [id]);
      // Отправка 8:00 → публикация 9:30 → снята 10:00 → снова 12:00; delete — без статуса.
      await retime(id, day20, [8, 9.5, 10, 12]);
      expect(await stats(day20, day20)).toMatchObject({
        published: 1,
        returned: 0,
        unit_published: 0,
        wait_count: 1,
        wait_avg_hours: 1.5,
        wait_max_hours: 1.5,
      });
    });

    it("ЖК без отчёта за месяц: возвращённый — «возвращён», черновик не виден, сданный блок не в счёте", async () => {
      const returned = await block("B");
      const drafted = await block("C");
      await block("D", ids.publicComplex, "delivered");
      const { id } = await kit.submit(video, await kit.report(video, { block_id: returned }));
      await returnReport(id, "Нет фасада");
      await kit.draft(video, await kit.report(video, { block_id: drafted }));

      const result = await stats(dates.month, dates.today);
      expect(result.month).toBe(dates.month);
      expect(result.month_open).toBe(true);
      const own = result.complexes_without.find((complex) => complex.id === ids.publicComplex)!;
      // publicBlock закрыт отчётом из второго теста (опубликован в этом месяце).
      // Отчёт опубликован только что — не «45+ дн.»; у ЖК-черновика опубликованных не было — «45+».
      expect(own).toMatchObject({ blocks_total: 3, blocks_done: 1, late: false });
      expect(result.complexes_without.find((complex) => complex.id === ids.draftComplex)).toMatchObject({
        last_published_at: null,
        late: true,
      });
      expect(own.missing).toEqual([
        { id: returned, name: "B", state: "returned" },
        { id: drafted, name: "C", state: "none" },
      ]);
      expect(own.name).toMatchObject({ ru: expect.any(String), uz: expect.any(String) });
      const { rows } = await db.admin.query<{ n: number }>(
        `select count(distinct b.complex_id)::int as n from public.blocks b
         join public.complexes c on c.id = b.complex_id
        where b.build_status = 'building' and c.status <> 'archived'`,
      );
      expect(result.complexes_building).toBe(rows[0]!.n);
      // Прошлый месяц — по нынешнему списку блоков, месяц закрыт.
      expect((await stats(dates.prev, dates.prev)).month_open).toBe(false);
    });

    it("архивный ЖК — не в списке «без отчёта»; ждут проверки — по последней отправке", async () => {
      await block("A", ids.hiddenComplex);
      await db.admin.query(
        "update public.complexes set status = 'archived', archived_at = now() where id = $1",
        [ids.hiddenComplex],
      );
      const result = await stats(dates.month, dates.today);
      expect(result.complexes_without.map((complex) => complex.id)).not.toContain(
        ids.hiddenComplex,
      );

      const waiting = await kit.submit(video, await kit.report(video, { unit_id: ids.units[1] }));
      await db.admin.query(
        `update public.audit_log set at = now() - interval '30 hours'
        where entity = 'progress_reports' and entity_id = $1`,
        [waiting.id],
      );
      const now = await stats(dates.today, dates.today);
      expect(now.waiting_now).toBe(1);
      expect(now.oldest_wait_hours).toBeGreaterThanOrEqual(30);
      expect(now.oldest_wait_hours).toBeLessThan(31);
    });
  },
);
