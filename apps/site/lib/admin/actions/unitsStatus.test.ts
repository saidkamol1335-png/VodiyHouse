import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffRole } from "@/lib/admin/access";

// Действия менеджера на «Квартирах» (статус, «Отменить», Н7, чтение) — по-настоящему: роль,
// разбор входа, вызов функции базы, сброс тега ЖК и разбор ответа. Сессия, Supabase и next/cache —
// заглушки; имена аргументов функций сверяет tests/db/rpc-contract.test.ts.

const { updateTag, revalidateTag } = vi.hoisted(() => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
}));
const db = vi.hoisted(() => ({
  allowed: true,
  roles: [] as StaffRole[][],
  calls: [] as [string, unknown][],
  reply: { data: null as unknown, error: null as unknown },
}));
vi.mock("next/cache", () => ({ updateTag, revalidateTag }));
vi.mock("@/lib/admin/session", () => ({
  requireActionViewer: async (roles: StaffRole[]) => {
    db.roles.push(roles);
    if (!db.allowed) return { ok: false, code: "forbidden" };
    const rpc = async (name: string, args: unknown) => {
      db.calls.push([name, args]);
      return db.reply;
    };
    return { ok: true, supabase: { rpc } };
  },
}));

const { revertUnitsStatusAction, setLayoutAvailableAction, setUnitsStatusAction } =
  await import("./unitsStatus");
const { readBlockUnitsAction } = await import("./unitsList");

const BLOCK = "00000000-0000-4000-8000-0000000000b1";
const UNIT = "00000001-0000-4000-8000-0000000000b1";
const LAYOUT = "00000000-0000-4000-8000-0000000000a1";
const COMPLEX = "00000000-0000-4000-8000-0000000000c1";

beforeEach(() => {
  Object.assign(db, { allowed: true, roles: [], calls: [], reply: { data: null, error: null } });
  updateTag.mockClear();
});

describe("действия менеджера на «Квартирах»", () => {
  it("статус: роль head и manager, функция базы, тег ЖК, undo из ответа", async () => {
    db.reply.data = { complex_id: COMPLEX, changed: 1, undo: [{ status: "free", ids: [UNIT] }] };
    const result = await setUnitsStatusAction({
      blockId: BLOCK,
      unitIds: [UNIT],
      status: "reserved",
    });
    expect(db.roles).toEqual([["head", "manager"]]);
    expect(db.calls).toEqual([
      ["set_units_status", { p_block: BLOCK, p_unit_ids: [UNIT], p_status: "reserved" }],
    ]);
    expect(updateTag.mock.calls).toEqual([[`complex:${COMPLEX}`], ["complexes"]]);
    expect(result).toEqual({
      status: "done",
      changed: 1,
      undo: [{ status: "free", ids: [UNIT] }],
    });
  });

  it("«Отменить»: прежние статусы группами, пропущенные — списком", async () => {
    db.reply.data = { complex_id: COMPLEX, reverted: 1, skipped: ["41", 7], missing: 1 };
    const undo = [{ status: "free" as const, ids: [UNIT] }];
    const result = await revertUnitsStatusAction({ blockId: BLOCK, status: "reserved", undo });
    expect(db.calls).toEqual([
      ["revert_units_status", { p_block: BLOCK, p_status: "reserved", p_undo: undo }],
    ]);
    expect(updateTag).toHaveBeenCalledWith(`complex:${COMPLEX}`);
    expect(result).toEqual({ status: "done", reverted: 1, skipped: ["41"], missing: 1 });
  });

  it("Н7: флаг планировки — тем же действием у обеих ролей", async () => {
    db.reply.data = { complex_id: COMPLEX, changed: 1 };
    expect(await setLayoutAvailableAction({ layoutId: LAYOUT, available: false })).toEqual({
      status: "done",
      changed: 1,
    });
    expect(db.roles).toEqual([["head", "manager"]]);
    expect(db.calls).toEqual([["set_layout_available", { p_layout: LAYOUT, p_available: false }]]);
    expect(updateTag).toHaveBeenCalledWith(`complex:${COMPLEX}`);
  });

  it("чтение списка — без сброса тега; ответ разбирается в записи", async () => {
    db.reply.data = [];
    expect(await readBlockUnitsAction({ blockId: BLOCK })).toEqual({ status: "done", units: [] });
    expect(db.roles).toEqual([["head", "manager", "videographer"]]);
    expect(db.calls).toEqual([["block_unit_rows", { p_block: BLOCK }]]);
    expect(updateTag).not.toHaveBeenCalled();
    db.reply.data = [{ id: "не квартира" }];
    expect(await readBlockUnitsAction({ blockId: BLOCK })).toMatchObject({ error: "unknown" });
  });

  it("неверный вход и отказ сессии — без обращения к базе и без сброса тега", async () => {
    expect(
      await setUnitsStatusAction({ blockId: BLOCK, unitIds: [UNIT], status: "x" as never }),
    ).toMatchObject({ status: "error", error: "invalid" });
    expect(
      await setLayoutAvailableAction({ layoutId: LAYOUT, available: "no" as never }),
    ).toMatchObject({ error: "invalid" });
    db.allowed = false;
    expect(
      await revertUnitsStatusAction({ blockId: BLOCK, status: "free", undo: [] }),
    ).toMatchObject({ error: "forbidden" });
    expect(db.calls).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("отказ базы — его код, тег не сбрасывается", async () => {
    db.reply.error = { code: "P0001", hint: "vh:forbidden", message: "x" };
    expect(
      await setUnitsStatusAction({ blockId: BLOCK, unitIds: [UNIT], status: "sold" }),
    ).toMatchObject({ status: "error", error: "forbidden" });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
