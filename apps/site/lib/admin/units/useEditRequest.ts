"use client";

import { useState } from "react";
import { usePresence } from "@/lib/ui/usePresence";
import { blockSwitching } from "./switching";
import type { EditReply, Shown } from "./useUnitsEdit";

/**
 * Отправка правки из формы: «Сохраняем…» на кнопке и отказ для формы. Ответ, пришедший после
 * закрытия формы, она не покажет — его покажет полоса (shown — «форма ещё на экране?»). Форма
 * уходящего блока (переход идёт) — уже не на экране: она inert и исчезнет вместе с блоком.
 */
export function useEditRequest() {
  const here = usePresence();
  const [reply, setReply] = useState<EditReply>(null);
  const [pending, setPending] = useState(false);
  const send = async (work: (shown: Shown) => Promise<EditReply>): Promise<EditReply> => {
    setPending(true);
    const result = await work(() => here() && !blockSwitching());
    setPending(false);
    setReply(result);
    return result;
  };
  // here — для того, что делать после ответа: закрытая форма не закрывает и не фокусирует чужое.
  return { reply, pending, send, clear: () => setReply(null), here };
}
