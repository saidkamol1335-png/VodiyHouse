import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { Copy, Kicker } from "./WhyParts";
import { WhyCard } from "./WhyCard";

/** «Проверка»: сканер проходит по пунктам ТЗ 8.4, галочки по очереди, печать «Проверено Vodiy House». */
export async function DocsTile() {
  const t = await getTranslations("home.why");
  return (
    <WhyCard className="home-why__tile--docs">
      <div className="home-why__docs">
        <Kicker index="04" text={t("docsKicker")} />
        <DocsSeal label={t("docsSealLabel")} text={t("docsSeal")} />
        {/* Заголовок — раньше списка: диктор по заголовкам не пропускает пункты; на экране он внизу (order). */}
        <div className="home-why__body home-why__body--end">
          <Copy title={t("docsTitle")} text={t("docsText")} />
        </div>
        <div className="home-why__checks-wrap home-why__rv home-why__rv--1">
          <ul className="home-why__checks">
            {t("docsChecks")
              .split(" · ")
              .map((check, index) => (
                <li
                  key={check}
                  className="home-why__check"
                  style={{ "--tick": `${1.08 + index * 0.41}s` } as CSSProperties}
                >
                  <span className="home-why__check-box" aria-hidden="true">
                    <span className="home-why__check-tick" />
                  </span>
                  {check}
                </li>
              ))}
          </ul>
          <span className="home-why__scan" aria-hidden="true" />
        </div>
      </div>
    </WhyCard>
  );
}

/** Печать «Проверено Vodiy House»: надпись по кругу (в full медленно вращается), галочка в центре. */
function DocsSeal({ label, text }: { label: string; text: string }) {
  return (
    <span className="home-why__seal" role="img" aria-label={label}>
      <svg className="home-why__seal-ring" viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <path id="home-why-seal-path" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
        </defs>
        <text>
          <textPath href="#home-why-seal-path" textLength="270" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      <span className="home-why__seal-core" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M5 12.5l4.3 4.3L19 7.2" />
        </svg>
      </span>
    </span>
  );
}
