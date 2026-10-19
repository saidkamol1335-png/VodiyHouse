"use client";

import type { ReactNode } from "react";
import { useMotion } from "@/lib/motion";
import { useTheme } from "@/lib/theme";

const COLOR_TOKENS = [
  ["--bg", "фон"],
  ["--bg-2", "карточка"],
  ["--bg-3", "поверхность"],
  ["--bg-4", "приглушённый фон"],
  ["--fg", "текст"],
  ["--fg-2", "вторичный"],
  ["--fg-3", "приглушённый"],
  ["--amber", "акцент"],
  ["--amber-2", "мелкий янтарный"],
  ["--gold", "курсив заголовка"],
  ["--ok", "успех"],
  ["--bad", "ошибка"],
  ["--s-free-b", "свободна"],
  ["--s-res-b", "бронь"],
  ["--s-sold-b", "продана"],
] as const;

const TYPE_ROLES = [
  ["h1", "heading heading--h1", "Квартиры в новостройках"],
  ["h2", "heading heading--h2", "Подборки ЖК"],
  ["h3", "heading heading--h3", "ЖК Shodlik"],
  ["h4", "heading heading--h4", "Платёж в месяц"],
  ["lead", "token-preview__lead", "Наличие обновляется в реальном времени."],
  ["body", "token-preview__body", "Farg‘ona Sifat Qurilish · ул. Мустакиллик, 12"],
  ["mono", "token-preview__mono", "Срок сдачи · 4 кв. 2027"],
] as const;

const RADII = ["--r-xs", "--r-s", "--r-m", "--r-l", "--r-xl", "--r-2xl", "--r-pill"] as const;
const SHADOWS = ["--shadow-1", "--shadow-2", "--shadow-hover", "--shadow-3"] as const;

function Swatches() {
  return (
    <ul className="token-preview__swatches">
      {COLOR_TOKENS.map(([token, label]) => (
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

export function TokenPreview({ children }: { children?: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const motion = useMotion();
  return (
    <main className="token-preview">
      <header className="token-preview__bar">
        <strong>Витрина токенов · фаза 0</strong>
        <span className="token-preview__mono">
          тема: {theme} · режим: <b data-testid="motion-tier">{motion}</b>
        </span>
        <button type="button" className="token-preview__button" onClick={toggleTheme}>
          {theme === "dark" ? "☀ Светлая" : "☾ Тёмная"}
        </button>
        <a className="token-preview__button" href="?motion=full">?motion=full</a>
        <a className="token-preview__button" href="?motion=lite">?motion=lite</a>
      </header>

      {children}

      <section className="token-preview__section">
        <h2 className="heading heading--h3">Цвета: тема страницы и тёмная рядом</h2>
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
        <h2 className="heading heading--h3">Шрифты по ролям</h2>
        {TYPE_ROLES.map(([role, className, sample]) => (
          <div key={role} className="token-preview__type-row">
            <span className="token-preview__mono">{role}</span>
            <span className={className}>{sample}</span>
          </div>
        ))}
      </section>

      <section className="token-preview__section">
        <h2 className="heading heading--h3">Радиусы и тени</h2>
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
