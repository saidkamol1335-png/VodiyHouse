import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "ok" | "amber" | "bad" | "blue" | "line";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  size?: "md" | "sm";
  /** Точка перед текстом — статус («● Опубликован»), а не просто метка. */
  dot?: boolean;
};

/** Плашка мокапа (.badge): статусы, счётчики, пометки. */
export function Badge({ children, tone = "neutral", size = "md", dot = false }: BadgeProps) {
  const classes = ["badge", `badge--${tone}`];
  if (size === "sm") classes.push("badge--sm");
  return (
    <span className={classes.join(" ")}>
      {dot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
