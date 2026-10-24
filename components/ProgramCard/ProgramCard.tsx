"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import type { ProgramItem, ProgramPanel } from "@/lib/admin/programs/types";
import type { ExchangeRate } from "@/lib/calc/money";
import {
  exampleText,
  programChips,
  programMark,
  programRows,
  programSubtitle,
  programFullName,
  programTitle,
  type ProgramsT,
} from "./cardText";

export type ProgramCardTools = {
  open: boolean;
  first: boolean;
  last: boolean;
  pending: boolean;
  /** Отказ тумблера этой карточки — строкой под шапкой. */
  refusal: string | null;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onMove: (direction: "up" | "down") => void;
};

type ProgramCardProps = {
  item: ProgramItem;
  panel: ProgramPanel;
  rate: ExchangeRate | null;
  /** Только у руководителя: тумблер, «Изменить», стрелки (менеджер читает). */
  tools?: ProgramCardTools;
  /** Превью в редакторе (В1): та же карточка без действий. */
  preview?: boolean;
};

/** Карточка программы (мокап CabProg): знак, название, тумблер, чипы, условия, «Пример». */
export function ProgramCard({ item, panel, rate, tools, preview = false }: ProgramCardProps) {
  const t = useTranslations("admin.programs");
  const title = programTitle(item, t);
  const example = exampleText(item, panel, rate, t);
  const classes = ["program-card"];
  if (!item.isActive) classes.push("program-card--off");
  if (preview) classes.push("program-card--preview");
  const Tag = preview ? "div" : "li";
  return (
    <Tag className={classes.join(" ")} data-testid={preview ? "program-preview" : "program-card"}>
      <div className="program-card__head">
        <span className="program-card__mark" aria-hidden="true">
          {programMark(item, panel.name)}
        </span>
        <span className="program-card__titles">
          <b className="program-card__title">{title}</b>
          <span className="program-card__subtitle">{programSubtitle(item, t)}</span>
        </span>
        <ProgramState
          item={item}
          title={programFullName(item, t)}
          tools={preview ? undefined : tools}
          t={t}
        />
      </div>
      {tools?.refusal && !preview ? (
        <p className="program-card__refusal" role="alert">
          {tools.refusal}
        </p>
      ) : null}
      <ProgramChips item={item} t={t} />
      <dl className="program-card__kv">
        {programRows(item, panel, t).map((row) => (
          <div key={row.key} className="program-card__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {example ? <p className="program-card__example">{example}</p> : null}
      {tools && !preview ? <CardTools tools={tools} t={t} /> : null}
    </Tag>
  );
}

function ProgramState(props: {
  item: ProgramItem;
  title: string;
  tools?: ProgramCardTools;
  t: ProgramsT;
}) {
  const { item, title, tools, t } = props;
  const label = item.isActive ? t("card.on") : t("card.off");
  if (!tools) {
    return (
      <Badge tone={item.isActive ? "ok" : "neutral"} size="sm" dot className="program-card__state">
        {label}
      </Badge>
    );
  }
  return (
    <Switch
      checked={item.isActive}
      label={label}
      accessibleName={t("card.toggleLabel", { name: title })}
      disabled={tools.pending}
      onChange={tools.onToggle}
      className="program-card__switch"
    />
  );
}

function ProgramChips({ item, t }: { item: ProgramItem; t: ProgramsT }) {
  const chips = programChips(item, t);
  if (chips.length === 0) return null;
  return (
    <ul className="program-card__chips">
      {chips.map((chip) => (
        <li key={chip.key} className="program-card__chip">
          <b>{chip.value}</b>
          <span>{chip.note}</span>
        </li>
      ))}
    </ul>
  );
}

function CardTools({ tools, t }: { tools: ProgramCardTools; t: ProgramsT }) {
  return (
    <div className="program-card__tools">
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={tools.open}
        onClick={tools.onEdit}
        className="program-card__edit"
      >
        {tools.open ? t("card.close") : t("card.edit")}
        <ChevronDown size={16} aria-hidden="true" className="program-card__chevron" />
      </Button>
      <span className="program-card__moves">
        <button
          type="button"
          className="program-card__move"
          aria-label={t("card.up")}
          disabled={tools.first || tools.pending}
          onClick={() => tools.onMove("up")}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="program-card__move"
          aria-label={t("card.down2")}
          disabled={tools.last || tools.pending}
          onClick={() => tools.onMove("down")}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
