"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { FilterPills } from "@/components/FilterPills";

type DeveloperPillsProps = {
  label: string;
  developers: readonly { slug: string; name: string }[];
  value: string;
  wrap?: boolean;
};

// Пилюлю нажали — калькулятор пересоздаётся с данными нового застройщика (ключ в обёртке), и
// фокус ушёл бы на body: запоминаем, куда его вернуть после перерисовки.
let refocus: string | null = null;

/**
 * Застройщик — пилюли (мокап /kalkulyator «01», «Расчёт для клиента»): смена — новый адрес
 * ?developer=slug, данные выбранного читает сервер; остальные параметры расчёта сбрасываются.
 */
export function DeveloperPills({ label, developers, value, wrap }: DeveloperPillsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (refocus !== value) return;
    refocus = null;
    box.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  }, [value]);
  if (developers.length < 2) return null;
  const pills = developers.map((developer) => ({ key: developer.slug, label: developer.name }));
  return (
    <div ref={box}>
      <FilterPills
        label={label}
        pills={pills}
        value={value}
        wrap={wrap}
        onChange={(slug) => {
          refocus = slug;
          router.replace(`${pathname}?developer=${encodeURIComponent(slug)}`, { scroll: false });
        }}
      />
    </div>
  );
}
