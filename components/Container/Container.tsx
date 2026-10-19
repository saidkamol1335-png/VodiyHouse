import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  narrow?: boolean;
  as?: "div" | "section" | "main" | "header" | "footer";
};

/** Ширина контента 1280 px и поля 32 / 16 px — как .wrap в мокапе. */
export function Container({ children, narrow = false, as: Tag = "div" }: ContainerProps) {
  return <Tag className={narrow ? "container container--narrow" : "container"}>{children}</Tag>;
}
