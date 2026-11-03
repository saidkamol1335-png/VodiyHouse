import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Публикация отчёта (фаза E, п. 13): правило 1.2 до копий, копии incoming → публичные бакеты, занятый
// адрес заменяется копией сервера, откат — только созданных и без ссылок, уборка incoming после успеха.

vi.mock("./progressNotify", () => ({ notifyAuthor: vi.fn(async () => true) }));
vi.mock("./progressOverview", () => ({ clientVideoUrl: () => "https://site/ru/video/r1" }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const { isSafeCopy, publishProgress } = await import("./progressPublish");

const UID = "11111111-1111-4111-8111-111111111111";
const CID = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";
const OUT = "44444444-4444-4444-8444-444444444444";
const photo = { from: `${UID}/${CID}/${FILE}.jpg`, to: `complexes/${CID}/${OUT}.jpg`, bucket: "media" };

type Call = { op: string; args: unknown[] };

function clients(options: { comment?: string; copy?: (n: number) => unknown; publish?: unknown } = {}) {
  const calls: Call[] = [];
  let copies = 0;
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { comment: { ru: options.comment ?? "Двор", uz: "Hovli" } }, error: null }) }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      calls.push({ op: name, args: [args] });
      if (name === "progress_publish_files") return { data: { version: "v2", files: [photo] }, error: null };
      return (
        options.publish ?? {
          data: { id: "r1", complex_id: CID, author_id: UID, is_unit: false, slug: "s", incoming: [photo.from], notice: {} },
          error: null,
        }
      );
    },
  } as unknown as SupabaseClient;
  const admin = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ op: name, args: [args] });
      return { data: [], error: null };
    },
    storage: {
      from: (bucket: string) => ({
        copy: async (...args: unknown[]) => {
          calls.push({ op: `copy:${bucket}`, args });
          return { error: options.copy?.(copies++) ?? null };
        },
        remove: async (paths: string[]) => {
          calls.push({ op: `remove:${bucket}`, args: [paths] });
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { supabase, admin, calls };
}

const input = { id: "r1", checked: true, version: "v1", actorId: "head" };

describe("публикация отчёта с копией файлов (фаза E)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("пара копии — из incoming в свой бакет, тот же ЖК", () => {
    expect(isSafeCopy(photo)).toBe(true);
    expect(isSafeCopy({ ...photo, bucket: "progress-video" })).toBe(false);
    expect(isSafeCopy({ ...photo, to: `complexes/${UID}/${OUT}.jpg` })).toBe(false);
    expect(isSafeCopy({ ...photo, from: `complexes/${CID}/${FILE}.jpg` })).toBe(false);
    expect(isSafeCopy({ ...photo, from: `../${CID}/${FILE}.jpg` })).toBe(false);
  });

  it("контакты в комментарии — отказ до копий", async () => {
    const { supabase, admin, calls } = clients({ comment: "Звоните +998 90 123 45 67" });
    expect(await publishProgress(supabase, admin, input)).toEqual({ ok: false, error: "contacts" });
    expect(calls).toEqual([]);
  });

  it("успех: копия, публикация с версией базы, incoming удаляется", async () => {
    const { supabase, admin, calls } = clients();
    expect(await publishProgress(supabase, admin, input)).toEqual({ ok: true, complexId: CID });
    expect(calls.map((call) => call.op)).toEqual([
      "progress_publish_files",
      "copy:incoming",
      "publish_progress_report",
      "remove:incoming",
    ]);
    expect(calls[2]!.args[0]).toMatchObject({ p_version: "v2" });
  });

  it("адрес занят — заменяется копией сервера", async () => {
    const { supabase, admin, calls } = clients({ copy: (n) => (n === 0 ? { statusCode: "409", message: "exists" } : null) });
    expect((await publishProgress(supabase, admin, input)).ok).toBe(true);
    expect(calls.map((call) => call.op).slice(1, 4)).toEqual(["copy:incoming", "remove:media", "copy:incoming"]);
  });

  it("сбой публикации — созданные копии без ссылок удаляются, incoming остаётся", async () => {
    const { supabase, admin, calls } = clients({ publish: { data: null, error: { code: "23514", hint: "vh:files", message: "" } } });
    expect(await publishProgress(supabase, admin, input)).toEqual({ ok: false, error: "reportFiles" });
    const ops = calls.map((call) => call.op);
    expect(ops).toContain("progress_public_refs");
    expect(ops).toContain("remove:media");
    expect(ops).not.toContain("remove:incoming");
  });

  it("копия не удалась — публикации нет", async () => {
    const { supabase, admin, calls } = clients({ copy: () => ({ statusCode: "500", message: "boom" }) });
    expect(await publishProgress(supabase, admin, input)).toEqual({ ok: false, error: "copyFailed" });
    expect(calls.map((call) => call.op)).not.toContain("publish_progress_report");
  });
});
