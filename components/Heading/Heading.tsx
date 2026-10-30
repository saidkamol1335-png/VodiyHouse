import type { CSSProperties, ReactNode } from "react";

type HeadingProps = {
  level: 1 | 2 | 3 | 4;
  children: ReactNode;
  /** Курсив Cormorant в конце заголовка: «Квартиры в новостройках Ферганы — по цене застройщика». */
  accent?: ReactNode;
};

/** Текст по словам — для появления в Reveal variant="words". Пробелы остаются: диктор и поиск читают фразу как есть. */
function splitWords(text: ReactNode, first: number): { nodes: ReactNode; next: number } {
  if (typeof text !== "string") return { nodes: text, next: first };
  let next = first;
  const nodes = text.split(/( +)/).map((part, index) => {
    if (part === "" || part.startsWith(" ")) return part;
    const order = next++;
    return (
      <span key={index} className="heading__word" style={{ "--i": order } as CSSProperties}>
        {part}
      </span>
    );
  });
  return { nodes, next };
}

export function Heading({ level, children, accent }: HeadingProps) {
  const Tag = `h${level}` as const;
  // h1 — первый экран и LCP: всегда цельным текстом.
  const words = level === 2;
  const lead = words ? splitWords(children, 0) : { nodes: children, next: 0 };
  const tail = words ? splitWords(accent, lead.next).nodes : accent;
  return (
    <Tag className={`heading heading--h${level}`}>
      {lead.nodes}
      {accent ? <span className="heading__accent">{tail}</span> : null}
    </Tag>
  );
}
