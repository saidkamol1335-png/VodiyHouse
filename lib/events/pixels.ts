import { onTrack } from "./client";
import type { SiteEvent } from "./types";

// Meta Pixel и GA4 (шаг 3.12, PLAN §7): только если заданы ID (NEXT_PUBLIC_META_PIXEL_ID,
// NEXT_PUBLIC_GA4_ID — у заказчика на «Запуске»). Скрипты — после первого действия посетителя или в
// простое, не с первым экраном (Lighthouse); события до загрузки ждут в очереди самих пикселей.
// Баннер cookie — если скажет юрист (PLAN §9.18).

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[][]; loaded?: boolean; version?: string; push?: unknown };
type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq; dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? "";

/** Наши события → стандартные события пикселей (лиды и просмотры ЖК — для оптимизации рекламы). */
const META_EVENTS: Partial<Record<SiteEvent["type"], string>> = {
  page_view: "PageView",
  complex_view: "ViewContent",
  lead_sent: "Lead",
  phone_click: "Contact",
  telegram_click: "Contact",
  favorite: "AddToWishlist",
};
const GA4_EVENTS: Partial<Record<SiteEvent["type"], string>> = {
  page_view: "page_view",
  complex_view: "view_item",
  lead_sent: "generate_lead",
  phone_click: "contact",
  telegram_click: "contact",
  favorite: "add_to_wishlist",
  share: "share",
  filter: "search",
};

function addScript(src: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.append(script);
}

function startMeta(win: PixelWindow): void {
  const queue: unknown[][] = [];
  const fbq: Fbq = (...args) => queue.push(args);
  Object.assign(fbq, { queue, loaded: true, version: "2.0", push: fbq });
  win.fbq = win._fbq = fbq;
  addScript("https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", META_ID);
}

function startGa4(win: PixelWindow): void {
  win.dataLayer = win.dataLayer ?? [];
  win.gtag = (...args) => win.dataLayer!.push(args);
  win.gtag("js", new Date());
  // page_view шлём сами — при клиентских переходах GA4 его не видит.
  win.gtag("config", GA4_ID, { send_page_view: false });
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`);
}

let started = false;

/** Запустить пиксели (один раз на вкладку) и пересылать им события сайта. Без ID — ничего. */
export function startPixels(): void {
  if (started || (!META_ID && !GA4_ID)) return;
  started = true;
  const win = window as PixelWindow;
  if (META_ID) startMeta(win);
  if (GA4_ID) startGa4(win);
  const forward = (event: SiteEvent) => {
    const meta = META_EVENTS[event.type];
    if (meta && win.fbq) win.fbq("track", meta);
    const ga = GA4_EVENTS[event.type];
    if (ga && win.gtag) win.gtag("event", ga, { page_path: event.path, detail: event.detail });
  };
  onTrack(forward);
  // Пиксели стартуют после первого действия — просмотр текущей страницы им ещё не известен.
  forward({ type: "page_view", path: `${window.location.pathname}${window.location.search}` });
}

export const hasPixels = Boolean(META_ID || GA4_ID);
