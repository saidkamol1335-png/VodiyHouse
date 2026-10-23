"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMotion } from "@/lib/motion";
import { useTheme } from "@/lib/theme";

// Подпись — ключ admin.dev.preview.tokens.colors; статусы квартир — подписи журнала.
const COLOR_TOKENS = [
  ["--bg", "bg"],
  ["--bg-2", "bg2"],
  ["--bg-3", "bg3"],
  ["--bg-4", "bg4"],
  ["--fg", "fg"],
  ["--fg-2", "fg2"],
  ["--fg-3", "fg3"],
  ["--amber", "amber"],
  ["--amber-2", "amber2"],
  ["--gold", "gold"],
  ["--ok", "ok"],
  ["--bad", "bad"],
] as const;
const STATUS_TOKENS = [
  ["--s-free-b", "free"],
  ["--s-res-b", "reserved"],
  ["--s-sold-b", "sold"],
] as const;

const TYPE_ROLES = [
  ["h1", "heading heading--h1"],
  ["h2", "heading heading--h2"],
  ["h3", "heading heading--h3"],
  ["h4", "heading heading--h4"],
  ["lead", "token-preview__lead"],
  ["body", "token-preview__body"],
  ["mono", "token-preview__mono"],
] as const;

const RADII = ["--r-xs", "--r-s", "--r-m", "--r-l", "--r-xl", "--r-2xl", "--r-pill"] as const;
const SHADOWS = ["--shadow-1", "--shadow-2", "--shadow-hover", "--shadow-3"] as const;

function Swatches() {
  const t = useTranslations("admin");
  const swatches = [
    ...COLOR_TOKENS.map(([token, key]) => [token, t(`dev.preview.tokens.colors.${key}`)] as const),
    ...STATUS_TOKENS.map(([token, key]) => [token, t(`journal.unitStatus.${key}`)] as const),
  ];
  return (
    <ul className="token-preview__swatches">
      {swatches.map(([token, label]) => (
        <li key={token} className="token-preview__swatch">
          <span className="token-preview__chip" style={{ background: `var(${token})` }} />
          <span className="token-preview__caption">
            <code>{token}</code> {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Образец текста роли: у h3 — название ЖК, как на сайте. */
function TypeSample({ role, className }: { role: (typeof TYPE_ROLES)[number][0]; className: string }) {
  const t = useTranslations("admin");
  const sample =
    role === "h3"
      ? t("complexes.namePrefixed", { name: "Shodlik" })
      : t(`dev.preview.tokens.samples.${role}`);
  return <span className={className}>{sample}</span>;
}

export function TokenPreview({ children }: { children?: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const motion = useMotion();
  const t = useTranslations("admin.dev.preview.tokens");
  const header = useTranslations("header");
  return (
    <main className="token-preview">
      <header className="token-preview__bar">
        <strong>{t("title")}</strong>
        <span className="token-preview__mono">
          {t.rich("status", {
            theme,
            motion,
            b: (chunks) => <b data-testid="motion-tier">{chunks}</b>,
          })}
        </span>
        <button type="button" className="token-preview__button" onClick={toggleTheme}>
          {theme === "dark" ? `☀ ${header("themeLight")}` : `☾ ${header("themeDark")}`}
        </button>
        <a className="token-preview__button" href="?motion=full">?motion=full</a>
        <a className="token-preview__button" href="?motion=lite">?motion=lite</a>
      </header>

      {children}

      <section className="token-preview__section">
        <h2 className="heading heading--h3">{t("sections.colors")}</h2>
        <div className="token-preview__themes">
          <div className="token-preview__panel">
            <Swatches />
          </div>
          <div className="token-preview__panel" data-theme-island="dark">
            <Swatches />
          </div>
        </div>
      </section>

      <section className="token-preview__section">
        <h2 className="heading heading--h3">{t("sections.type")}</h2>
        {TYPE_ROLES.map(([role, className]) => (
          <div key={role} className="token-preview__type-row">
            <span className="token-preview__mono">{role}</span>
            <TypeSample role={role} className={className} />
          </div>
        ))}
      </section>

      <section className="token-preview__section">
        <h2 className="heading heading--h3">{t("sections.shape")}</h2>
        <div className="token-preview__row">
          {RADII.map((token) => (
            <div key={token} className="token-preview__radius" style={{ borderRadius: `var(${token})` }}>
              <code>{token}</code>
            </div>
          ))}
        </div>
        <div className="token-preview__row">
          {SHADOWS.map((token) => (
            <div key={token} className="token-preview__shadow" style={{ boxShadow: `var(${token})` }}>
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
