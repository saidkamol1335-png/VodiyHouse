"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { markCalcNavigation } from "@/components/PaymentCalculator/useCalcParams";
import type { CalcHeroExample } from "./CalcHero";

/** Те же параметры, порядок неважен: адрес примера и строка адреса страницы. */
function sameQuery(href: string, current: URLSearchParams): boolean {
  const example = new URLSearchParams(href.split("?")[1] ?? "");
  if ([...example.keys()].length !== [...current.keys()].length) return false;
  return [...example].every(([key, value]) => current.get(key) === value);
}

type CalcHeroExamplesProps = { label: string; examples: readonly CalcHeroExample[] };

/**
 * Примеры расчёта (мокапы SiteCalc1, SiteCalc2): применённый — янтарный и aria-current, пока
 * адрес совпадает с примером; поправили расчёт — это уже не пример, отметка снимается.
 */
export function CalcHeroExamples({ label, examples }: CalcHeroExamplesProps) {
  const current = useSearchParams();
  return (
    <nav className="calc-hero__examples" aria-label={label}>
      <span className="calc-hero__examples-label">{label}</span>
      {examples.map((example) => {
        const active = sameQuery(example.href, current);
        return (
          <Link
            key={example.href}
            href={example.href}
            className={
              active ? "calc-hero__example calc-hero__example--active" : "calc-hero__example"
            }
            aria-current={active ? "true" : undefined}
            onClick={(event) => {
              const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
              // Новая вкладка или тот же пример — в этой вкладке перехода нет, адрес пишем как обычно.
              if (!modified && event.button === 0 && !active) markCalcNavigation();
            }}
          >
            <b>{example.title}</b>
            <span className="calc-hero__example-note">{example.note}</span>
          </Link>
        );
      })}
    </nav>
  );
}
