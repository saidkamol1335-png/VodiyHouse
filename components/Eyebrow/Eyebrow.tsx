import type { ReactNode } from "react";

type EyebrowProps = {
  children: ReactNode;
  as?: "p" | "span" | "div";
};

/** Надзаголовок раздела: моно, капс, пунктир слева — как в мокапе. */
export function Eyebrow({ children, as: Tag = "p" }: EyebrowProps) {
  return <Tag className="eyebrow">{children}</Tag>;
}
