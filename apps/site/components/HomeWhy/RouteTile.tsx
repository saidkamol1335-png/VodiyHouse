import { House, KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Copy, Kicker } from "./WhyParts";
import { WhyCard } from "./WhyCard";

/** Маршрут «змейкой» (десктоп) и столбиком (узкая карточка): шаги горят по очереди, в конце «0 сум». */
const ROUTE_PATH = "M100 40 H370 A47 47 0 0 1 370 134 H100 A47 47 0 0 0 100 228 H370";

export async function RouteTile() {
  const t = await getTranslations("home.why");
  const steps = t("route").split(" · ");
  const total = (
    <>
      <span>{t("routeTotal")}</span>
      <b>{t("routeTotalValue")}</b>
    </>
  );
  return (
    <WhyCard className="home-why__tile--route" delay={120}>
      <div className="home-why__split home-why__split--route">
        <div className="home-why__copy">
          <Kicker index="05" text={t("freeKicker")} />
          <div className="home-why__body">
            <Copy title={t("freeTitle")} text={t("freeText")} />
          </div>
        </div>
        <RouteMap steps={steps} total={total} />
        <RouteFlow steps={steps} total={total} />
      </div>
    </WhyCard>
  );
}

function RouteChip({ step, index, last }: { step: string; index: number; last: boolean }) {
  return (
    <span className="home-why__route-chip">
      {last ? <span className="home-why__chip-ring" aria-hidden="true" /> : null}
      <span className="home-why__chip-lit" aria-hidden="true" />
      {last ? (
        <span className="home-why__chip-ico" aria-hidden="true">
          <KeyRound size={15} />
        </span>
      ) : (
        <span className="home-why__chip-num" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <span className="home-why__chip-txt">{step}</span>
    </span>
  );
}

type RouteProps = { steps: string[]; total: ReactNode };

function RouteMap({ steps, total }: RouteProps) {
  return (
    <div className="home-why__map home-why__rv home-why__rv--2">
      <svg className="home-why__map-svg" viewBox="0 0 470 300" aria-hidden="true">
        <path d={ROUTE_PATH} />
      </svg>
      <span className="home-why__pin home-why__pin--map" aria-hidden="true">
        <House size={13} strokeWidth={2.5} />
      </span>
      <ol className="home-why__nodes">
        {steps.map((step, index) => (
          <li key={step} className={`home-why__node home-why__node--${index}`}>
            <RouteChip step={step} index={index} last={index === steps.length - 1} />
          </li>
        ))}
      </ol>
      <p className="home-why__total home-why__total--map">{total}</p>
    </div>
  );
}

function RouteFlow({ steps, total }: RouteProps) {
  return (
    <div className="home-why__flow home-why__rv home-why__rv--2">
      <span className="home-why__pin home-why__pin--flow" aria-hidden="true">
        <House size={13} strokeWidth={2.5} />
      </span>
      <ol className="home-why__steps">
        {steps.map((step, index) => (
          <li key={step} className={`home-why__step home-why__step--${index}`}>
            <span className="home-why__step-node" aria-hidden="true" />
            <RouteChip step={step} index={index} last={index === steps.length - 1} />
          </li>
        ))}
      </ol>
      <p className="home-why__total home-why__total--flow">{total}</p>
    </div>
  );
}
