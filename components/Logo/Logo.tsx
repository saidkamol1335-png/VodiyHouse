import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";

// Знак Vodiy House из мокапа: дома из янтарных прямоугольников на общей линии земли.
const MARK_RECTS = [
  [26.7, 0, 41.6, 10.6], [26.7, 10.6, 10.2, 15.7], [58.1, 10.6, 10.2, 84], [13.9, 26.3, 33.2, 10.6],
  [13.9, 36.9, 10.5, 57.7], [36.6, 36.9, 10.5, 57.7], [77.1, 0, 42.3, 10.6], [77.1, 10.6, 10.5, 84],
  [108.9, 10.6, 10.5, 15.7], [99, 26.3, 32.6, 10.6], [99, 36.9, 10.2, 57.7], [121.3, 36.9, 10.3, 57.7],
  [0, 99.4, 147.4, 10.3],
] as const;

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
};

export function Logo({ hideText = false }: LogoProps) {
  const t = useTranslations("header");
  return (
    <Link href={ROUTES.home} className="logo" aria-label={t("home")}>
      <LogoMark />
      <span className={hideText ? "logo__text logo__text--hidden" : "logo__text"}>Vodiy House</span>
    </Link>
  );
}
