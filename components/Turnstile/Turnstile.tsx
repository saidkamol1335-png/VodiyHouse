"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/captcha";

// Проверка «не робот» (Cloudflare Turnstile) в формах входа: виджет сам кладёт в форму скрытое поле
// cf-turnstile-response (lib/captcha.ts), действие передаёт его в Supabase Auth. Без ключа сайта —
// ничего не рисует. Токен одноразовый: после каждой попытки (attempt меняется) виджет сбрасывается.

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};
type TurnstileWindow = Window & { turnstile?: TurnstileApi };

let loading: Promise<TurnstileApi> | null = null;

/** Скрипт Cloudflare — один раз на вкладку. */
function loadTurnstile(): Promise<TurnstileApi> {
  const ready = (window as TurnstileWindow).turnstile;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const api = (window as TurnstileWindow).turnstile;
      if (api) resolve(api);
      else reject(new Error("turnstile-missing"));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile-load"));
    };
    document.head.append(script);
  });
  return loading;
}

type TurnstileProps = {
  /** Подпись для экранного диктора. */
  label: string;
  /** Номер попытки (состояние формы): изменился — токен потрачен, виджет сбрасывается. */
  attempt: unknown;
};

export function Turnstile({ label, attempt }: TurnstileProps) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    const node = container.current;
    if (!TURNSTILE_SITE_KEY || !node) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || widget.current) return;
        widget.current = api.render(node, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "ru",
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          size: "flexible",
        });
      })
      // Скрипт не загрузился — форма отправится без токена, Supabase ответит «captchaFailed».
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (widget.current) (window as TurnstileWindow).turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (widget.current) (window as TurnstileWindow).turnstile?.reset(widget.current);
  }, [attempt]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={container} className="turnstile" role="group" aria-label={label} />;
}
