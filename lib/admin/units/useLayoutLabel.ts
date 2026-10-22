"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { formatArea } from "@/lib/format";
import { layoutVariants } from "./layoutVariants";
import type { UnitsLayout } from "./types";

type Labelled = Pick<UnitsLayout, "id" | "rooms" | "area">;

/** «2-комн. · 64,5 м²», у двойника — ещё «· вариант 2» (layoutVariants). */
export function useLayoutLabel(layouts: readonly Labelled[]): (layout: Labelled) => string {
  const t = useTranslations("admin.complexes.units");
  const variants = useMemo(() => layoutVariants(layouts), [layouts]);
  return useCallback(
    (layout) => {
      const label = t("layoutLabel", { rooms: layout.rooms, area: formatArea(layout.area) });
      const variant = variants.get(layout.id);
      return variant ? `${label} · ${t("layoutVariant", { n: variant })}` : label;
    },
    [t, variants],
  );
}
