"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import type { Point } from "@/lib/admin/facade/contours";

type ContourToolsProps = { points: Point[]; onChange: (points: Point[]) => void; children: ReactNode };

/** Под редактором: сколько точек, «Убрать последнюю точку», «Очистить» и кнопки сохранения. */
export function ContourTools({ points, onChange, children }: ContourToolsProps) {
  const t = useTranslations("admin.complexes.facade");
  return (
    <div className="facade-tab__row">
      <span className="field__meta">{t("points", { count: points.length })}</span>
      <Button variant="outline" size="sm" disabled={points.length === 0} onClick={() => onChange(points.slice(0, -1))}>
        {t("undoPoint")}
      </Button>
      <Button variant="outline" size="sm" disabled={points.length === 0} onClick={() => onChange([])}>
        {t("clear")}
      </Button>
      {children}
    </div>
  );
}
