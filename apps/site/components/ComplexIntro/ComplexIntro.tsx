import type { ReactNode } from "react";

type ComplexIntroProps = {
  /** Короткое описание ЖК (кабинет «О ЖК → Короткое описание»). */
  text: string | null;
  /** Видео застройщика (ComplexVideos — YouTube по нажатию, ТЗ 7.5); нет — только текст. */
  video: ReactNode;
};

/**
 * Над каруселью «Loyiha tafsilotlari» (правки 15.11, п. 22, уточнение 20.11 — как «О комплексе» на
 * Cian: описание → видео → особенности): на 1024+ — текст слева, видео справа; на телефоне — столбиком.
 * Нечего показать — ничего.
 */
export function ComplexIntro({ text, video }: ComplexIntroProps) {
  if (!text && !video) return null;
  return (
    <div className={text && video ? "complex-intro complex-intro--split" : "complex-intro"}>
      {text ? <p className="complex-intro__text">{text}</p> : null}
      {video ? <div className="complex-intro__video">{video}</div> : null}
    </div>
  );
}
