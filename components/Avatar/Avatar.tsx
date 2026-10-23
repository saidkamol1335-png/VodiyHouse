import { initialsOf } from "@/lib/format";

type AvatarProps = {
  name: string;
  /** sm — рядом с кнопкой ☀/☾ в верхней строке (её размер: 34 px, на телефоне 40 px). */
  size?: "md" | "sm";
  /** Микс с элементом блока-владельца по БЭМ: место и размер задаёт его CSS. */
  className?: string;
};

/** Кружок с инициалами сотрудника (мокап: .ava--amber). */
export function Avatar({ name, size = "md", className }: AvatarProps) {
  const classes = ["avatar"];
  if (size === "sm") classes.push("avatar--sm");
  if (className) classes.push(className);
  return (
    <span className={classes.join(" ")} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
