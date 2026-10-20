"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField, type BilingualValue } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { DeliveryBadge } from "@/components/DeliveryBadge";
import { QuarterSelect } from "@/components/QuarterSelect";

type ProjectRow = {
  key: string;
  name: BilingualValue;
  plannedOn: string | null;
  deliveredOn: string | null;
};

// DEMO: сданные объекты Farg‘ona Sifat Qurilish из мокапа (как в supabase/demo/seed.sql).
const DEMO_ROWS: ProjectRow[] = [
  {
    key: "demo-1",
    name: { ru: "Дом на ул. Мустакиллик, 14", uz: "Mustaqillik ko‘chasi, 14-uy" },
    plannedOn: "2021-06-30",
    deliveredOn: "2021-06-30",
  },
  {
    key: "demo-2",
    name: { ru: "ЖК Sifat City", uz: "Sifat City" },
    plannedOn: "2022-12-31",
    deliveredOn: "2023-03-31",
  },
];

const YEARS = { min: 2000, max: 2040 };

/** /dev/admin-kit: вкладка «Сданные объекты» (решение Д5). Только разработка. */
export function AdminKitProjects() {
  const t = useTranslations("admin.developers.projects");
  const [rows, setRows] = useState<ProjectRow[]>(DEMO_ROWS);
  const update = (key: string, patch: Partial<ProjectRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const add = () =>
    setRows((current) => [
      ...current,
      { key: crypto.randomUUID(), name: { ru: "", uz: "" }, plannedOn: null, deliveredOn: null },
    ]);

  return (
    <AdminPanel title={t("title")} wide>
      <ul className="admin-kit-projects">
        {rows.map((row) => (
          <li key={row.key} className="admin-kit-projects__row" data-testid="project-row">
            <div className="admin-kit-projects__name">
              <BilingualField
                id={`project-${row.key}`}
                name={`projects.${row.key}.name`}
                label={t("name")}
                uzLabel={t("nameUz")}
                maxLength={80}
                defaultValue={row.name}
              />
            </div>
            <QuarterSelect
              id={`project-${row.key}-planned`}
              name={`projects.${row.key}.plannedOn`}
              label={t("planned")}
              defaultValue={row.plannedOn}
              minYear={YEARS.min}
              maxYear={YEARS.max}
              onChange={(plannedOn) => update(row.key, { plannedOn })}
            />
            <QuarterSelect
              id={`project-${row.key}-delivered`}
              name={`projects.${row.key}.deliveredOn`}
              label={t("delivered")}
              defaultValue={row.deliveredOn}
              minYear={YEARS.min}
              maxYear={YEARS.max}
              onChange={(deliveredOn) => update(row.key, { deliveredOn })}
            />
            <div className="admin-kit-projects__end">
              <span data-testid="project-status">
                <DeliveryBadge plannedOn={row.plannedOn} deliveredOn={row.deliveredOn} />
              </span>
              <button
                type="button"
                className="admin-kit-projects__remove"
                aria-label={t("remove")}
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" onClick={add}>
        + {t("add")}
      </Button>
    </AdminPanel>
  );
}
