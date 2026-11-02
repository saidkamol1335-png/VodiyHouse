import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { unitsFailure } from "./errors";
import { useEditRequest } from "./useEditRequest";
import type { EditReply } from "./useUnitsEdit";

describe("отправка правки из формы", () => {
  it("«Сохраняем…» на время запроса, отказ — форме; форма на экране — shown() да", async () => {
    const hook = renderHook(() => useEditRequest());
    let answer: (reply: EditReply) => void = () => {};
    let seen: boolean | null = null;
    let sending: Promise<EditReply> = Promise.resolve(null);
    act(() => {
      sending = hook.result.current.send((shown) => {
        seen = shown();
        return new Promise((resolve) => (answer = resolve));
      });
    });
    expect(hook.result.current.pending).toBe(true);
    expect(seen).toBe(true);
    await act(async () => {
      answer(unitsFailure("timeout"));
      await sending;
    });
    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.reply).toMatchObject({ error: "timeout" });
    act(() => hook.result.current.clear());
    expect(hook.result.current.reply).toBeNull();
  });

  it("форму закрыли до ответа — here() нет: закрывать и фокусировать уже нечего", async () => {
    const hook = renderHook(() => useEditRequest());
    const { here } = hook.result.current;
    expect(here()).toBe(true);
    hook.unmount();
    expect(here()).toBe(false);
  });
});
