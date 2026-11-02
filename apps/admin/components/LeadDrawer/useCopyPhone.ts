"use client";

import { useEffect, useState } from "react";
import { formatPhone } from "@/lib/contacts";

const DONE_MS = 2_000;

export type CopyPhone = { run: () => void; done: boolean; failed: boolean };

/** «Скопировать номер»: «Номер скопирован» на 2 с; буфер недоступен — подсказка скопировать вручную. */
export function useCopyPhone(phone: string): CopyPhone {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), DONE_MS);
    return () => clearTimeout(timer);
  }, [state]);
  const run = () => {
    const copied = navigator.clipboard?.writeText(formatPhone(phone));
    if (!copied) return setState("failed");
    copied.then(
      () => setState("done"),
      () => setState("failed"),
    );
  };
  return { run, done: state === "done", failed: state === "failed" };
}
