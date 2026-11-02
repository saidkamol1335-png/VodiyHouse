"use client";

import dynamic from "next/dynamic";
import { type AbstractIntlMessages, NextIntlClientProvider, useLocale, useMessages, useTranslations } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { LeadIntent } from "@/components/LeadForm";
import { leadMessagesAction } from "@/lib/leads/messages";
import { rememberVisitSource } from "@/lib/leads/source";

// Одно окно заявки на страницу (шаг 3.7): кнопки только просят «открыть с таким-то типом», а окно с
// формой, действием и своими текстами грузится отдельно — каталог из 30 карточек не несёт 30 форм,
// а HTML каждой страницы — текстов окна. Грузится заранее, при первом действии посетителя (после
// ревью блока D): нажатие на 3G не «молчит» секунды; не успело — видно «Открываем форму…».

const loadDialog = () => import("./LeadDialog").then((module) => module.LeadDialog);
const LeadDialog = dynamic(loadDialog, { ssr: false });
const FIRST_ACTIONS = ["scroll", "pointerdown", "keydown", "touchstart"] as const;
const NOTICE_MS = 4000;

/** from — кнопка, открывшая окно: Safari при нажатии фокус на кнопку не ставит, activeElement — body. */
type LeadOpener = (intent: LeadIntent, from?: HTMLElement) => void;

const LeadContext = createContext<LeadOpener | null>(null);

/**
 * Тексты и код окна — вместе: «готово», только когда есть и то и другое. Один запрос на вкладку; не
 * пришло (сеть, новый деплой) — false, следующее нажатие спросит снова.
 */
function useLeadMessages() {
  const locale = useLocale();
  const [messages, setMessages] = useState<AbstractIntlMessages | null>(null);
  const loading = useRef<Promise<boolean> | null>(null);
  const load = useCallback(() => {
    loading.current ??= Promise.all([leadMessagesAction(locale), loadDialog()]).then(
      ([loaded]) => {
        setMessages(loaded);
        return true;
      },
      () => {
        loading.current = null;
        return false;
      },
    );
    return loading.current;
  }, [locale]);
  return { locale, messages, load };
}

/**
 * Метки первого захода (ТЗ 10.3) — сразу; тексты и код окна — при первом действии посетителя
 * (прокрутка, касание, клавиша): к нажатию кнопки они уже здесь, а ушедший сразу не делает запрос.
 */
function usePreloadOnFirstAction(load: () => Promise<boolean>, enabled: boolean) {
  useEffect(() => {
    rememberVisitSource(window.location.href, document.referrer);
    if (!enabled) return;
    const preload = () => {
      stop();
      void load();
    };
    const stop = () => FIRST_ACTIONS.forEach((name) => window.removeEventListener(name, preload));
    FIRST_ACTIONS.forEach((name) => window.addEventListener(name, preload, { passive: true }));
    return stop;
  }, [load, enabled]);
}

/** «Открываем форму…» и «Нет связи» — строка внизу экрана (тексты оболочки, siteError). */
function LeadNotice({ kind }: { kind: "loading" | "offline" }) {
  const t = useTranslations("siteError");
  return (
    <p className={`lead-dialog__notice lead-dialog__notice--${kind}`} role="status">
      {t(kind === "loading" ? "leadLoading" : "leadOffline")}
    </p>
  );
}

type LeadProviderProps = {
  children: ReactNode;
  /** false — тексты и код окна только по нажатию (стенды кабинета считают свои запросы). */
  preload?: boolean;
};

export function LeadProvider({ children, preload = true }: LeadProviderProps) {
  const shell = useMessages();
  const lead = useLeadMessages();
  const [open, setOpen] = useState<{ intent: LeadIntent; key: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  usePreloadOnFirstAction(lead.load, preload);
  useEffect(() => {
    if (!offline) return;
    const id = window.setTimeout(() => setOffline(false), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [offline]);
  const openLead = useCallback<LeadOpener>(
    (intent, from) => {
      opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setOffline(false);
      setOpen((current) => ({ intent, key: (current?.key ?? 0) + 1 }));
      void lead.load().then((loaded) => {
        if (loaded) return;
        setOpen(null);
        setOffline(true);
      });
    },
    [lead],
  );
  const close = useCallback(() => {
    setOpen(null);
    // Фокус — на кнопку, которая открыла окно (dialog сам возвращает его не во всех браузерах).
    opener.current?.focus();
  }, []);
  return (
    <LeadContext.Provider value={openLead}>
      {children}
      {open && lead.messages ? (
        <NextIntlClientProvider locale={lead.locale} messages={{ ...shell, ...lead.messages }}>
          <LeadDialog key={open.key} intent={open.intent} onClose={close} />
        </NextIntlClientProvider>
      ) : null}
      {open && !lead.messages ? <LeadNotice kind="loading" /> : null}
      {offline ? <LeadNotice kind="offline" /> : null}
    </LeadContext.Provider>
  );
}

/** Открыть окно заявки; без провайдера (стенды) — null: кнопка заявки не показывается. */
export function useLeadOpener(): LeadOpener | null {
  return useContext(LeadContext);
}
