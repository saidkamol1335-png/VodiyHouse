import { describe, expect, it, vi } from "vitest";
import { handleTelegramUpdate, type BotDeps, type TelegramUpdate } from "./bot";

// Бот «Написать в Telegram» (Ф8): что отвечает и какую заявку создаёт — без Telegram и базы.

const START = { code: "abcdefgh12345678abcdef", site_lang: "ru", object: { complex: "demo-shodlik" }, page_url: "/ru/novostroyki/demo-shodlik", source: { utm_source: "instagram" } };

function deps(start: object | null = START) {
  const rpc = vi.fn(async (name: string) => ({
    data: name === "bind_tg_start" ? { site_lang: "ru", complex: { ru: "Shodlik", uz: "Shodlik" } } : name === "tg_start_for_chat" ? start : null,
    error: null,
  }));
  const reply = vi.fn<BotDeps["reply"]>(async () => undefined);
  const submit = vi.fn(async () => ({ status: "sent" as const, number: 1045, repeat: false, id: "lead-id" }));
  const value: BotDeps = { admin: { rpc } as unknown as BotDeps["admin"], reply, submit, chatKey: (id) => `chat-${id}` };
  return { value, rpc, reply, submit };
}

const message = (patch: Partial<NonNullable<TelegramUpdate["message"]>>): TelegramUpdate => ({
  message: { chat: { id: 7, type: "private" }, from: { id: 7, first_name: "Азиз", username: "aziz_f", language_code: "uz" }, ...patch },
});

describe("бот «Написать в Telegram»", () => {
  it("/start <код>: привязка к чату, приветствие с ЖК на языке сайта и «Поделиться номером»", async () => {
    const bot = deps();
    await handleTelegramUpdate(message({ text: `/start ${START.code}` }), bot.value);
    expect(bot.rpc).toHaveBeenCalledWith("bind_tg_start", { p_code: START.code, p_chat: 7 });
    const [chat, text, keyboard] = bot.reply.mock.calls[0] as unknown as [number, string, { keyboard: { request_contact: boolean }[][] }];
    expect(chat).toBe(7);
    expect(text).toContain("Вас интересует ЖК Shodlik.");
    expect(keyboard.keyboard[0]![0]!.request_contact).toBe(true);
  });

  it("свой контакт → заявка «Telegram-бот» с ЖК, страницей, метками и ником; спасибо с номером", async () => {
    const bot = deps();
    await handleTelegramUpdate(message({ contact: { phone_number: "998901234567", user_id: 7, first_name: "Азиз" } }), bot.value);
    expect(bot.submit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tg", phone: "+998901234567", complex: "demo-shodlik", source: { utm_source: "instagram" }, payload: { telegram: "aziz_f" } }),
      "chat-7",
    );
    expect(bot.rpc).toHaveBeenCalledWith("finish_tg_start", { p_code: START.code, p_lead: "lead-id" });
    expect(bot.reply.mock.calls.at(-1)?.[1]).toContain("#1045");
  });

  it("чужой контакт — не заявка; номер текстом — заявка; иностранный номер — просьба +998", async () => {
    const bot = deps(null);
    await handleTelegramUpdate(message({ contact: { phone_number: "998901234567", user_id: 99 } }), bot.value);
    expect(bot.submit).not.toHaveBeenCalled();
    await handleTelegramUpdate(message({ text: "+998 90 123 45 67" }), bot.value);
    expect(bot.submit).toHaveBeenCalledWith(expect.objectContaining({ site_lang: "uz", phone: "+998901234567" }), "chat-7");
    await handleTelegramUpdate(message({ contact: { phone_number: "+7 912 000 00 00", user_id: 7 } }), bot.value);
    expect(bot.reply.mock.calls.at(-1)?.[1]).toContain("+998");
  });

  it("текст с девятью цифрами («Бюджет 450 000 000») — не номер: подсказка, без заявки", async () => {
    const bot = deps(null);
    await handleTelegramUpdate(message({ text: "Бюджет 450 000 000 сум" }), bot.value);
    expect(bot.submit).not.toHaveBeenCalled();
    expect(bot.reply.mock.calls.at(-1)?.[2]).toMatchObject({ keyboard: expect.any(Array) });
  });

  it("сбой базы при чтении перехода — без заявки, просьба повторить", async () => {
    const bot = deps();
    bot.rpc.mockImplementationOnce(async () => ({ data: null, error: { message: "timeout" } as never }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await handleTelegramUpdate(message({ text: "+998 90 123 45 67" }), bot.value);
    expect(bot.submit).not.toHaveBeenCalled();
    expect(bot.reply).toHaveBeenCalledTimes(1);
  });

  it("сообщения групп (чат менеджеров) бот не обрабатывает", async () => {
    const bot = deps();
    await handleTelegramUpdate({ message: { chat: { id: -100, type: "supergroup" }, text: "/start" } }, bot.value);
    expect(bot.reply).not.toHaveBeenCalled();
  });
});

// Фаза E (п. 36): /start h_<токен> мобилографа — уведомления об отчётах, без тревоги о втором факторе.
describe("бот: привязка Telegram сотрудника", () => {
  const TOKEN = `h_${"a".repeat(32)}`;
  const staff = (role: string, linked: string | null = "user-1") => {
    const rpc = vi.fn(async () => ({ data: linked, error: null }));
    const maybeSingle = vi.fn(async () => ({ data: { role, full_name: "Азиз" }, error: null }));
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
    const reply = vi.fn<BotDeps["reply"]>(async () => undefined);
    const value: BotDeps = {
      admin: { rpc, from } as unknown as BotDeps["admin"],
      reply,
      submit: vi.fn(),
      chatKey: (id) => `chat-${id}`,
    };
    return { value, rpc, reply };
  };

  it("мобилограф — «уведомления об отчётах будут приходить сюда»", async () => {
    const bot = staff("mobilographer");
    await handleTelegramUpdate(message({ text: `/start ${TOKEN}` }), bot.value);
    expect(bot.rpc).toHaveBeenCalledWith("complete_staff_telegram_link", expect.objectContaining({ p_chat: 7 }));
    expect(bot.reply).toHaveBeenCalledTimes(1);
    expect(String(bot.reply.mock.calls[0]![1])).toContain("уведомления об отчётах");
  });

  it("ссылка устарела — так и отвечает", async () => {
    const bot = staff("mobilographer", null);
    await handleTelegramUpdate(message({ text: `/start ${TOKEN}` }), bot.value);
    expect(String(bot.reply.mock.calls[0]![1])).toContain("Ссылка устарела");
  });
});
