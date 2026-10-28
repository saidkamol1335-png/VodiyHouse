import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { MARK_RECTS } from "@/components/Logo/markRects";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n/routing";
import { loadOgFonts, OG_FONT_FAMILY } from "@/lib/og/fonts";
import { SITE_NAME } from "@/lib/site/metadata";

// Превью ссылки на сайт (Telegram, соцсети): страницы без своей картинки берут эту. Цвета — светлая
// тема styles/tokens.css (--bg, --fg, --fg-3, --amber, --gold): satori не знает CSS-переменных.
const COLOR = { bg: "#f4f1eb", fg: "#17140f", muted: "#6d665a", amber: "#f89b0d", gold: "#b8650a" } as const;

// Шрифты не зависят от запроса — читаются один раз при загрузке модуля: так картинка собирается
// при сборке (чтение файла в обработчике делало её динамической — рендер на каждое превью).
const FONTS = await loadOgFonts();

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Satori не переносит текст из нескольких элементов — заголовок раскладывается по словам. */
function words(text: string, color: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (
      <span key={`${word}-${index}`} style={{ color }}>
        {word}
      </span>
    ));
}

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "home.hero" });
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72, background: COLOR.bg, color: COLOR.fg, fontFamily: OG_FONT_FAMILY }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width={96} height={72} viewBox="0 0 148 110">
            {MARK_RECTS.map(([x, y, width, height]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} fill={COLOR.amber} />
            ))}
          </svg>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" }}>{SITE_NAME}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: COLOR.gold }}>
            {t("eyebrow")}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, maxWidth: 1000, fontSize: 64, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.04em" }}>
            {words(t("titleLead"), COLOR.fg)}
            {words(t("titleAccent"), COLOR.gold)}
          </div>
        </div>
        <span style={{ fontSize: 26, fontWeight: 600, color: COLOR.muted }}>vodiyhouse.uz</span>
      </div>
    ),
    { ...size, fonts: FONTS },
  );
}
