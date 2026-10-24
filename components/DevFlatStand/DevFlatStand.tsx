"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { FlatCalculator } from "@/components/FlatCalculator";
import type { DemoFlatLayout } from "@/lib/admin/calc/flatDemo";
import type { FlatCalcScreen } from "@/lib/calc/flatScreen";
import { CALC_HINT_DRAFTS } from "@/lib/calc/hints";
import type { CalcParams } from "@/lib/calc/params";

const AREA = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

type LayoutCardProps = {
  layout: DemoFlatLayout;
  expanded: boolean;
  opener: (node: HTMLButtonElement | null) => void;
  onOpen: () => void;
};

/** Карточка планировки: «2-комн. · 64,2 м²», ЖК и блок, «Рассчитать оплату». */
function LayoutCard({ layout, expanded, opener, onOpen }: LayoutCardProps) {
  const t = useTranslations("calc");
  return (
    <li className="dev-flat-stand__layout">
      <b>
        {t("flat.title", {
          rooms: t("price.rooms", { count: layout.rooms }),
          area: AREA.format(layout.area),
        })}
      </b>
      <span>{t("flat.standBlock", { block: layout.blockName })}</span>
      <Button ref={opener} variant="outline" aria-expanded={expanded} onClick={onOpen}>
        {t("flat.open")}
      </Button>
    </li>
  );
}

type DevFlatStandProps = {
  layouts: readonly DemoFlatLayout[];
  open: { screen: FlatCalcScreen; params: CalcParams } | null;
};

/**
 * Стенд «Расчёта для этой квартиры» (шаг 2.7): карточки планировок с «Рассчитать оплату», как
 * раздел «Планировки» страницы ЖК (фаза 3); открытый расчёт — на 1440 под ними, на телефоне шторкой.
 */
export function DevFlatStand({ layouts, open }: DevFlatStandProps) {
  const t = useTranslations("calc");
  const router = useRouter();
  const pathname = usePathname();
  const openers = useRef(new Map<string, HTMLButtonElement>());
  // Каждое «Рассчитать оплату» — новое открытие (та же планировка, закрытие ещё в пути).
  const [opened, setOpened] = useState(0);
  // Закрыли — фокус на «Рассчитать оплату» той планировки, расчёт которой закрыли.
  const close = () => {
    router.replace(pathname, { scroll: false });
    if (open) openers.current.get(open.screen.layout.id)?.focus();
  };
  const openPlan = (id: string) => {
    setOpened((count) => count + 1);
    router.replace(`${pathname}?plan=${encodeURIComponent(id)}`, { scroll: false });
  };
  return (
    <div className="dev-flat-stand">
      <h1 className="dev-flat-stand__title">{t("flat.standTitle")}</h1>
      <ul className="dev-flat-stand__layouts">
        {layouts.map((layout) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            expanded={open?.screen.layout.id === layout.id}
            opener={(node) => {
              if (node) openers.current.set(layout.id, node);
              else openers.current.delete(layout.id);
            }}
            onOpen={() => openPlan(layout.id)}
          />
        ))}
      </ul>
      {open ? (
        <FlatCalculator
          key={`${open.screen.layout.id}-${opened}`}
          id="flat-calc"
          screen={open.screen}
          initialParams={open.params}
          leadEnabled
          onClose={close}
          hints={CALC_HINT_DRAFTS}
        />
      ) : null}
    </div>
  );
}
