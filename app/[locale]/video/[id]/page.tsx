import { CalendarCheck, Film, Send } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { LeadButton } from "@/components/LeadDialog";
import { PhoneButton } from "@/components/PhoneButton";
import { TelegramButton } from "@/components/TelegramButton";
import { SiteHeader } from "@/components/SiteHeader";
import { UnitVideoCalc, UnitVideoReports } from "@/components/UnitVideo";
import { formatArea, formatMonthYear } from "@/lib/format";
import type { CalcHints } from "@/lib/calc/hints";
import { pickMessages, UNIT_VIDEO_MESSAGES } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import { Link } from "@/lib/i18n/navigation";
import { complexRoute } from "@/lib/routes";
import { readSiteContacts } from "@/lib/site/contacts";
import { LEAD_FORM_ENABLED } from "@/lib/site/flags";
import { readSiteCalcHints } from "@/lib/site/hints";
import { pageMetadata } from "@/lib/site/metadata";
import type { UnitVideo } from "@/lib/site/progress/records";
import { readUnitVideo } from "@/lib/site/progress/read";

// Адрес читается сразу, вне <Suspense>: чужой или снятый отчёт отвечает 404 (как у страницы ЖК). У layout
// той же настройки dev-проверке мгновенного перехода мало — она смотрит на страницу.
export const instant = false;

// Ссылка менеджера клиенту (PLAN фазы 5): страница вне поиска (noindex, не в sitemap), без входа.
// cacheComponents требует хотя бы один адрес при сборке: заглушка отвечает 404.
export async function generateStaticParams() {
  return [{ id: "00000000-0000-0000-0000-000000000000" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/video/[id]">): Promise<Metadata> {
  const [{ id }, localeRaw, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("unitVideo"),
  ]);
  const locale = isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const result = await readUnitVideo(id);
  const name = result.kind === "page" ? result.video.complex.name[locale] : "";
  return pageMetadata({
    locale,
    path: `/video/${id}`,
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
    noindex: true,
  });
}

/** «ЖК Shodlik · Блок B · 2-комн. · 58,7 м² · 6 этаж» — без номера квартиры (мокап .vp__meta). */
async function metaOf(
  video: UnitVideo,
  locale: Locale,
): Promise<{ parts: string[]; book: string }> {
  const [t, tComplex, tProgress] = await Promise.all([
    getTranslations("unitVideo"),
    getTranslations("complex"),
    getTranslations("complex.progress"),
  ]);
  const rooms =
    video.rooms === null
      ? null
      : video.rooms <= 4
        ? tComplex(`rooms.${video.rooms as 0 | 1 | 2 | 3 | 4}`)
        : tComplex("rooms.more", { n: video.rooms });
  const complex = tComplex("name", { name: video.complex.name[locale] });
  const area = video.area === null ? null : formatArea(video.area, locale);
  const present = (part: string | null): part is string => Boolean(part);
  return {
    parts: [
      complex,
      video.block ? tProgress("block", { name: video.block.name }) : null,
      rooms,
      area,
      video.floor === null ? null : t("floor", { n: video.floor }),
    ].filter(present),
    // Контекст заявки «ЖК Shodlik · 2-комн. · 58,7 м² · из видео» — без блока, этажа и номера.
    book: [complex, rooms, area, t("fromVideo")].filter(present).join(" · "),
  };
}

/**
 * Видео квартиры для клиента (фаза 5, мокап SiteVideo / MobVideo): как квартира выглядит сейчас,
 * что сделано за месяц, предыдущие месяцы, готовность блока, кнопки Vodiy House (правило 1.2) и
 * расчёт платежа по планировке. Номера квартиры нет нигде.
 */
export default async function UnitVideoRoute({ params }: PageProps<"/[locale]/video/[id]">) {
  const [{ id }, messages, localeRaw] = await Promise.all([params, getMessages(), getLocale()]);
  const locale = (isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE) as Locale;
  const result = await readUnitVideo(id);
  if (result.kind !== "page") notFound();
  const { video } = result;
  const [meta, hints] = await Promise.all([metaOf(video, locale), readSiteCalcHints()]);
  const complexHref = complexRoute(video.complex.slug);
  return (
    <NextIntlClientProvider messages={pickMessages(messages, UNIT_VIDEO_MESSAGES)}>
      <SiteHeader backHref={complexHref} pageTitle={meta.parts[0]} />
      <main className="unit-video">
        <Container>
          <VideoHead video={video} meta={meta.parts} locale={locale} />
          <UnitVideoReports
            video={video}
            aside={<VideoAside video={video} context={meta.book} />}
          />
          {video.layoutId ? (
            <PaySection video={video} layoutId={video.layoutId} hints={hints} />
          ) : null}
        </Container>
      </main>
    </NextIntlClientProvider>
  );
}

const accent = (chunks: ReactNode) => <em className="unit-video__accent">{chunks}</em>;

/** «← ЖК Shodlik», «Видео квартиры для вас», «Как квартира выглядит сейчас», мета и бейджи (мокап .vp__head). */
async function VideoHead({
  video,
  meta,
  locale,
}: {
  video: UnitVideo;
  meta: string[];
  locale: Locale;
}) {
  const t = await getTranslations("unitVideo");
  return (
    <>
      <Link href={complexRoute(video.complex.slug)} className="unit-video__back">
        ← {t("back", { name: video.complex.name[locale] })}
      </Link>
      <p className="unit-video__eyebrow">{t("eyebrow")}</p>
      <h1 className="unit-video__title">{t.rich("title", { accent })}</h1>
      <ul className="unit-video__meta">
        {meta.map((part) => (
          <li key={part}>{part}</li>
        ))}
      </ul>
      <p className="unit-video__badges">
        <span className="unit-video__badge unit-video__badge--level">
          <Film size={14} aria-hidden="true" />
          {t("levelUnit")}
        </span>
        <span className="unit-video__badge">
          {t("state", { month: formatMonthYear(video.month, locale).toLowerCase() })}
        </span>
      </p>
    </>
  );
}

/** Правая колонка: готовность блока и «Хотите посмотреть вживую?» — только кнопки Vodiy House (правило 1.2). */
async function VideoAside({ video, context }: { video: UnitVideo; context: string }) {
  const [t, tLead, contacts] = await Promise.all([
    getTranslations("unitVideo"),
    getTranslations("lead.buttons"),
    readSiteContacts(),
  ]);
  // Заявка и Telegram — с ЖК и планировкой, без номера квартиры.
  const object = {
    complex: video.complex.slug,
    ...(video.layoutId ? { layout: video.layoutId } : {}),
  };
  const book = { type: "view" as const, object, context };
  return (
    <>
      <Readiness video={video} />
      <div className="unit-video__cta">
        <p className="unit-video__cta-title">{t("cta")}</p>
        <p className="unit-video__cta-text">{t("ctaText")}</p>
        <LeadButton intent={book} block>
          <CalendarCheck size={18} aria-hidden="true" />
          {tLead("view")}
        </LeadButton>
        {contacts.phone ? (
          <PhoneButton phone={contacts.phone} className="unit-video__phone" />
        ) : null}
        <TelegramButton object={object} className="button button--outline unit-video__telegram">
          <Send size={16} strokeWidth={1.9} aria-hidden />
          {t("telegram")}
        </TelegramButton>
        <Link href={complexRoute(video.complex.slug)} className="unit-video__to-complex">
          {t("toComplex")} →
        </Link>
      </div>
    </>
  );
}

/** «Сколько платить за эту квартиру» (мокап .vp__calc): калькулятор планировки по кнопке. */
async function PaySection({
  video,
  layoutId,
  hints,
}: {
  video: UnitVideo;
  layoutId: string;
  hints: CalcHints;
}) {
  const t = await getTranslations("unitVideo");
  return (
    <section className="unit-video__pay" aria-labelledby="unit-video-pay">
      <h2 id="unit-video-pay" className="unit-video__pay-title">
        {t.rich("calcTitle", { accent })}
      </h2>
      <p className="unit-video__pay-lead">{t("calcLead")}</p>
      <UnitVideoCalc
        layoutId={layoutId}
        complexSlug={video.complex.slug}
        hints={hints}
        leadEnabled={LEAD_FORM_ENABLED}
      />
    </section>
  );
}

/** «Готовность блока · 58% · 7 из 12 этажей · Сдача: 4 кв. 2027» (мокап .vp__ready). */
async function Readiness({ video }: { video: UnitVideo }) {
  const [t, tComplex, tProgress] = await Promise.all([
    getTranslations("unitVideo"),
    getTranslations("complex"),
    getTranslations("complex.progress"),
  ]);
  const block = video.block;
  if (!block || block.progressPct === null) return null;
  const facts = [
    block.floorsBuilt !== null && block.floorsTotal
      ? tProgress("floors", { built: block.floorsBuilt, total: block.floorsTotal })
      : null,
    block.deadline
      ? t("deadline", {
          quarter: tComplex("quarter", { q: block.deadline.quarter, year: block.deadline.year }),
        })
      : null,
  ].filter(Boolean);
  return (
    <div className="unit-video__ready">
      <p className="unit-video__label">{t("ready")}</p>
      <p className="unit-video__ready-value">{block.progressPct}%</p>
      <span className="unit-video__ready-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${block.progressPct / 100})` }} />
      </span>
      {facts.length > 0 ? <p className="unit-video__ready-facts">{facts.join(" · ")}</p> : null}
    </div>
  );
}
