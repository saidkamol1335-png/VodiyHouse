"use client";

import { useLocale } from "next-intl";
import type { MouseEvent, ReactNode } from "react";
import { useSiteContacts } from "@/components/SiteContacts";
import { telegramHref } from "@/lib/contacts";
import { leadSource } from "@/lib/leads/source";
import { telegramStartAction } from "@/lib/leads/telegramActions";
import type { LeadObject } from "@/lib/leads/types";

type TelegramButtonProps = {
  /** О чём пишут: ЖК и планировка — бот поздоровается с названием ЖК, заявка придёт с ним. */
  object: LeadObject;
  className: string;
  children: ReactNode;
  "aria-label"?: string;
  tabIndex?: number;
};

/** Новая вкладка — сразу по нажатию (иначе её заблокирует браузер), адрес — когда придёт код. */
async function openBot(bot: string, object: LeadObject, siteLang: string, fallback: string) {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  const code = await telegramStartAction({
    object,
    siteLang,
    pageUrl: `${window.location.pathname}${window.location.search}`,
    source: leadSource(),
  }).catch(() => null);
  const link = code ? `${telegramHref(bot)}?start=${code}` : fallback;
  if (tab) tab.location.href = link;
  else window.location.assign(link);
}

/**
 * «Написать в Telegram» (ТЗ 10.5, Ф8 A): с ботом из «Настройки → Контакты» — ссылка с кодом
 * перехода (ЖК, страница, метки рекламы); без бота — аккаунт Vodiy House. Только контакты Vodiy
 * House (правило 1.2); нет ни бота, ни аккаунта — кнопки нет.
 */
export function TelegramButton({ object, className, children, ...rest }: TelegramButtonProps) {
  const { bot, telegram } = useSiteContacts();
  const locale = useLocale();
  if (!bot && !telegram) return null;
  const fallback = telegramHref((telegram ?? bot)!);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Без бота — обычная ссылка на аккаунт; Ctrl/⌘-клик — тоже как ссылка.
    if (!bot || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    void openBot(bot, object, locale, fallback);
  };
  return (
    <a className={className} href={fallback} target="_blank" rel="noopener" onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
