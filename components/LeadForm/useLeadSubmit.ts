"use client";

import { useLocale } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { track } from "@/lib/events/client";
import { submitLeadAction } from "@/lib/leads/actions";
import { fieldErrorsOf } from "@/lib/leads/request";
import { leadSource } from "@/lib/leads/source";
import type {
  LeadCalc,
  LeadErrorCode,
  LeadField,
  LeadFieldErrors,
  LeadObject,
  LeadRequest,
  LeadSubmitResult,
  LeadType,
  SiteLang,
  ViewChoice,
} from "@/lib/leads/types";

/** С чем открыли форму: тип, объект и данные по типу (контекст для глаз — отдельно, в окне). */
export type LeadIntent = {
  type: LeadType;
  object?: LeadObject;
  /** «ЖК Shodlik · Блок A · 2-комн.» — плашка над полями (мокап `.ctx`); на сервер не уходит. */
  context?: string;
  /** Просмотр: что смотреть по умолчанию («О нас» — офис). */
  viewTarget?: ViewChoice["target"];
  filters?: LeadRequest["filters"];
  calc?: LeadCalc;
  calcRows?: LeadRequest["calcRows"];
  /** «Хочу это условие»: название спецпредложения или рекламы — менеджеру. */
  promo?: LeadRequest["promo"];
  /** Квиз: ответы словами, сколько подошло и ссылка на подходящие ЖК — менеджеру. */
  quiz?: LeadRequest["quiz"];
};

export type LeadContact = { name: string; phone: string; lang: SiteLang; trap: string };

/** «Застройщикам» (3.11): компания обязательна, остальное — по желанию. */
export type LeadPartner = NonNullable<LeadRequest["partner"]>;

export type LeadSent = { number: number; repeat: boolean };

const NETWORK: LeadSubmitResult = { status: "error", error: "network" };

/** Что уходит на сервер: тип и объект формы, контакт, страница, метки первого захода, данные по типу. */
function requestOf(intent: LeadIntent, contact: LeadContact, siteLang: SiteLang, view: ViewChoice | null, partner?: LeadPartner): LeadRequest {
  return {
    type: intent.type,
    name: contact.name,
    phone: contact.phone,
    contactLang: contact.lang,
    siteLang,
    object: intent.object ?? {},
    pageUrl: `${window.location.pathname}${window.location.search}`,
    source: leadSource(),
    ...(view ? { view } : {}),
    ...(partner ? { partner } : {}),
    ...(intent.filters ? { filters: intent.filters } : {}),
    ...(intent.calc ? { calc: intent.calc, calcRows: intent.calcRows } : {}),
    ...(intent.promo ? { promo: intent.promo } : {}),
    ...(intent.quiz ? { quiz: intent.quiz } : {}),
    trap: contact.trap,
  };
}

/** Проверка как на сервере → отправка → «отправлено» или ошибка; ошибки полей — фокус на первое. */
export function useLeadSubmit(id: string, intent: LeadIntent) {
  const locale = useLocale() as SiteLang;
  const [fields, setFields] = useState<LeadFieldErrors>({});
  const [error, setError] = useState<LeadErrorCode | null>(null);
  const [sent, setSent] = useState<LeadSent | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (contact: LeadContact, view: ViewChoice | null, partner?: LeadPartner) => {
    const invalid = fieldErrorsOf({ ...contact, company: partner?.company }, Boolean(partner));
    setFields(invalid);
    setError(null);
    const first = (["company", "name", "phone"] as const).find((key) => invalid[key]);
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    const request = requestOf(intent, contact, locale, view, partner);
    startTransition(async () => {
      const result = await submitLeadAction(request).catch(() => NETWORK);
      if (result.status === "sent") {
        setSent({ number: result.number, repeat: result.repeat });
        if (result.number > 0) track("lead_sent", { detail: intent.type });
      } else {
        setError(result.error);
        setFields(result.fields ?? {});
      }
    });
  };
  /** Правка поля снимает его ошибку — до следующей отправки. Стабильна: формы кладут её в зависимости. */
  const edited = useCallback((field: LeadField) => {
    setFields((current) => {
      if (!current[field]) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
  }, []);
  /** «Отправить ещё одну» (застройщик): снова пустая форма. */
  const reset = () => {
    setSent(null);
    setFields({});
    setError(null);
  };
  return { submit, fields, edited, error, sent, pending, reset };
}
