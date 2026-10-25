"use client";

import dynamic from "next/dynamic";
import { type AbstractIntlMessages, NextIntlClientProvider, useLocale, useMessages } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";
import type { LeadIntent } from "@/components/LeadForm";
import { leadMessagesAction } from "@/lib/leads/messages";

// Одно окно заявки на страницу (шаг 3.7): кнопки только просят «открыть с таким-то типом», а окно с
// формой, действием и своими текстами грузится при первом нажатии — каталог из 30 карточек не
// несёт 30 форм, а HTML каждой страницы — текстов окна.

const LeadDialog = dynamic(() => import("./LeadDialog").then((module) => module.LeadDialog), { ssr: false });

type LeadOpener = (intent: LeadIntent) => void;

const LeadContext = createContext<LeadOpener | null>(null);

/** Тексты окна: один запрос на вкладку; не пришли (сеть) — следующее нажатие спросит снова. */
function useLeadMessages() {
  const locale = useLocale();
  const [messages, setMessages] = useState<AbstractIntlMessages | null>(null);
  const loading = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    loading.current ??= leadMessagesAction(locale)
      .then((loaded) => setMessages(loaded))
      .catch(() => {
        loading.current = null;
      });
    return loading.current;
  }, [locale]);
  return { locale, messages, load };
}

export function LeadProvider({ children }: { children: ReactNode }) {
  const shell = useMessages();
  const lead = useLeadMessages();
  const [open, setOpen] = useState<{ intent: LeadIntent; key: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openLead = useCallback<LeadOpener>(
    (intent) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void lead.load();
      setOpen((current) => ({ intent, key: (current?.key ?? 0) + 1 }));
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
    </LeadContext.Provider>
  );
}

/** Открыть окно заявки; без провайдера (стенды) — null: кнопка заявки не показывается. */
export function useLeadOpener(): LeadOpener | null {
  return useContext(LeadContext);
}
