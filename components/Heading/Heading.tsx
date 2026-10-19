import type { ReactNode } from "react";

type HeadingProps = {
  level: 1 | 2 | 3 | 4;
  children: ReactNode;
  /** Курсив Cormorant в конце заголовка: «Квартиры в новостройках Ферганы — по цене застройщика». */
  accent?: ReactNode;
};

export function Heading({ level, children, accent }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag className={`heading heading--h${level}`}>
      {children}
      {accent ? <span className="heading__accent">{accent}</span> : null}
    </Tag>
  );
}
