"use client";

import { Children, type ReactNode, useState } from "react";

export type BlockTab = { id: string; name: string; status: string };

type BlockTabsProps = { label: string; tabs: readonly BlockTab[]; children: ReactNode };

/**
 * Блоки на телефоне — вкладками (мокап MobJk .seg: «Блок A · Сдан»), на 1440 — все карточки рядом
 * (CSS прячет вкладки). Без JS видны все карточки.
 */
export function BlockTabs({ label, tabs, children }: BlockTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const cards = Children.toArray(children);
  return (
    <>
      {tabs.length > 1 ? (
        <div className="complex-blocks__tabs" role="group" aria-label={label}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === active ? "complex-blocks__tab complex-blocks__tab--active" : "complex-blocks__tab"}
              aria-pressed={tab.id === active}
              onClick={() => setActive(tab.id)}
            >
              {tab.name}
              <small>{tab.status}</small>
            </button>
          ))}
        </div>
      ) : null}
      <div className="complex-blocks__grid">
        {cards.map((card, index) => (
          <div key={tabs[index]?.id ?? index} className="complex-blocks__cell" data-active={tabs[index]?.id === active ? "" : undefined}>
            {card}
          </div>
        ))}
      </div>
    </>
  );
}
