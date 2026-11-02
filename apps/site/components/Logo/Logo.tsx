import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { MARK_RECTS } from "./markRects";

export function LogoMark({ className = "logo__mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 148 110" aria-hidden="true">
      {MARK_RECTS.map(([x, y, width, height]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} fill="var(--amber)" />
      ))}
    </svg>
  );
}

type LogoProps = {
  /** На телефоне после прокрутки вместо «Vodiy House» показывается название страницы. */
  hideText?: boolean;
  /** Микс с элементом блока-владельца по БЭМ: место и размер задаёт его CSS. */
  className?: string;
};

export function Logo({ hideText = false, className }: LogoProps) {
  const t = useTranslations("header");
  return (
    <Link
      href={ROUTES.home}
      className={["logo", className].filter(Boolean).join(" ")}
      aria-label={t("home")}
    >
      <LogoMark />
      <span className={hideText ? "logo__text logo__text--hidden" : "logo__text"}>Vodiy House</span>
    </Link>
  );
}
