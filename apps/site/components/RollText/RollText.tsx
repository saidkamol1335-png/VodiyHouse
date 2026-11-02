import type { CSSProperties } from "react";

type RollTextProps = {
  text: string;
};

/**
 * Перекат букв при наведении (Oryzo в мокапе, решение Ш1): каждая буква — две копии,
 * при hover родителя-триггера (.roll-trigger) копии уезжают вверх с задержкой 18 мс по порядку.
 * Скринридер читает обычный текст, буквы скрыты от него.
 */
export function RollText({ text }: RollTextProps) {
  return (
    <>
      <span className="roll-text__label">{text}</span>
      <span className="roll-text" aria-hidden="true">
        {Array.from(text).map((char, index) => {
          const visible = char === " " ? " " : char;
          return (
            <span key={index} className="roll-text__char" style={{ "--i": index } as CSSProperties}>
              <span>{visible}</span>
              <span>{visible}</span>
            </span>
          );
        })}
      </span>
    </>
  );
}
