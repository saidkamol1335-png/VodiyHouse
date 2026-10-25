"use client";

import { createContext, type ReactNode, useContext } from "react";
import { NO_CONTACTS, type SiteContacts } from "@/lib/contacts";

// Контакты Vodiy House из «Настройки → Контакты» (Ф9). Читает layout сайта (данные), шапка, меню
// и подвал только показывают. Без провайдера (стенды /dev) — контактов нет, как до ответа заказчика.

const SiteContactsContext = createContext<SiteContacts>(NO_CONTACTS);

export function SiteContactsProvider({
  contacts,
  children,
}: {
  contacts: SiteContacts;
  children: ReactNode;
}) {
  return <SiteContactsContext.Provider value={contacts}>{children}</SiteContactsContext.Provider>;
}

export function useSiteContacts(): SiteContacts {
  return useContext(SiteContactsContext);
}
