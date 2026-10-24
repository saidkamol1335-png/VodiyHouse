"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import type { ProgramItem, ProgramPanel } from "@/lib/admin/programs/types";
import type { ExchangeRate } from "@/lib/calc/money";
import { type MoveDirection, useMoveFocus } from "@/lib/ui/useMoveFocus";
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
  /** Карточку только что переставили стрелкой — вернуть фокус на стрелку (узел переехал). */
  focusMove?: MoveDirection;
  onMoveFocused: () => void;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onMove: (direction: MoveDirection) => void;
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
  const example = exampleText(item, panel, rate, t);
  const actions = preview ? undefined : tools;
  const classes = ["program-card"];
  if (!item.isActive) classes.push("program-card--off");
  if (preview) classes.push("program-card--preview");
  const Tag = preview ? "div" : "li";
  return (
    <Tag
      className={classes.join(" ")}
      data-testid={preview ? "program-preview" : "program-card"}
      data-program-id={preview ? undefined : item.id}
    >
      <CardHead item={item} panel={panel} tools={actions} t={t} />
      <ProgramChips item={item} t={t} />
      <dl className="program-card__kv">
        {programRows(item, panel, rate, t).map((row) => (
          <div key={row.key} className="program-card__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {example ? <p className="program-card__example">{example}</p> : null}
      {actions ? <CardTools tools={actions} name={programFullName(item, t)} t={t} /> : null}
    </Tag>
  );
}

type CardHeadProps = {
  item: ProgramItem;
  panel: ProgramPanel;
  tools?: ProgramCardTools;
  t: ProgramsT;
};

/** Шапка: знак, название и вид, тумблер (или плашка у менеджера); отказ тумблера — строкой ниже. */
function CardHead({ item, panel, tools, t }: CardHeadProps) {
  return (
    <>
      <div className="program-card__head">
        <span className="program-card__mark" aria-hidden="true">
          {programMark(item, panel.name)}
        </span>
        <span className="program-card__titles">
          <b className="program-card__title">{programTitle(item, t)}</b>
          <span className="program-card__subtitle">{programSubtitle(item, t)}</span>
        </span>
        <ProgramState item={item} title={programFullName(item, t)} tools={tools} t={t} />
      </div>
      {tools?.refusal ? (
        <p className="program-card__refusal" role="alert">
          {tools.refusal}
        </p>
      ) : null}
    </>
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

function CardTools({ tools, name, t }: { tools: ProgramCardTools; name: string; t: ProgramsT }) {
  const [up, down] = useMoveFocus(tools.focusMove, tools.onMoveFocused);
  return (
    <div className="program-card__tools">
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={tools.open}
        aria-label={t("card.editFor", { name })}
        onClick={tools.onEdit}
        className="program-card__edit"
      >
        {tools.open ? t("card.close") : t("card.edit")}
        <ChevronDown size={16} aria-hidden="true" className="program-card__chevron" />
      </Button>
      <span className="program-card__moves">
        <button
          ref={up}
          type="button"
          className="program-card__move"
          aria-label={t("card.up", { name })}
          disabled={tools.first || tools.pending}
          onClick={() => tools.onMove("up")}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          ref={down}
          type="button"
          className="program-card__move"
          aria-label={t("card.down2", { name })}
          disabled={tools.last || tools.pending}
          onClick={() => tools.onMove("down")}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
