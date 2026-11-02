import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTelegram = vi.fn();
vi.mock("@/lib/leads/server/channels", () => ({
  telegramConfig: () => ({ token: "t", chatId: "leads", alertChatId: "alerts" }),
  sendTelegram: (...args: unknown[]) => sendTelegram(...args),
}));

const { remindProgress } = await import("./progressReminder");

// Время отметки — с микросекундами, как его отдаёт база: снять отметку можно только той же строкой.
const AT = "2026-10-29T04:00:00.123456+00:00";
const DUE = [
  { id: "a", name: "Namuna", last_published_at: "2026-08-02T07:00:00+00:00" },
  { id: "b", name: "Orzu", last_published_at: null },
];

function adminWith(claimed: string[]) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "progress_reminders_due") return { data: DUE, error: null };
    if (name === "claim_progress_reminders") return { data: { at: AT, ids: claimed }, error: null };
    return { data: null, error: null };
  });
  return { admin: { rpc } as unknown as SupabaseClient, rpc };
}

describe("напоминание о ходе строительства: отправка (5D.3)", () => {
  beforeEach(() => sendTelegram.mockReset());

  it("одно сообщение в чат тревог — только об отмеченных ЖК", async () => {
    sendTelegram.mockResolvedValue({ ok: true });
    const { admin } = adminWith(["b"]);
    expect(await remindProgress(admin)).toBe(1);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    const [, chat, text] = sendTelegram.mock.calls[0]!;
    expect(chat).toBe("alerts");
    expect(text).toContain("• Orzu — отчётов ещё нет");
    expect(text).not.toContain("Namuna");
  });

  it("второй запуск: отмечать нечего — не отправляет", async () => {
    const { admin } = adminWith([]);
    expect(await remindProgress(admin)).toBe(0);
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("не ушло — отметки снимаются тем же временем, строкой", async () => {
    sendTelegram.mockResolvedValue({ ok: false, error: "timeout" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin, rpc } = adminWith(["a", "b"]);
    expect(await remindProgress(admin)).toBe(0);
    expect(rpc).toHaveBeenLastCalledWith("release_progress_reminders", {
      p_ids: ["a", "b"],
      p_at: AT,
    });
  });
});
