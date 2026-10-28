"use client";

import { ChevronRight, Hand, Moon, Sun, Sunset } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { mediaPublicUrl } from "@/lib/media";
import { boxOf, polygonPoints, type Box } from "@/lib/site/picker/model";
import type { PickerUnit, Point } from "@/lib/site/picker/records";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { freeByRooms, useBlockLabels } from "./blockLabels";
import type { PickerBlockView } from "./ComplexPicker";

export const FACADE_LIGHTS = ["day", "dusk", "night"] as const;
export type FacadeLight = (typeof FACADE_LIGHTS)[number];

const LIGHT_ICONS = { day: Sun, dusk: Sunset, night: Moon } as const;

type PickerFacadeProps = {
  facade: CatalogPhoto;
  contours: { id: string; contour: Point[] }[];
  blocks: PickerBlockView[];
  units: Record<string, PickerUnit[]>;
  light: FacadeLight;
  onLight: (light: FacadeLight) => void;
  onPick: (blockId: string) => void;
  /** Блок, из которого вернулись «Все корпуса», — фокус на его подпись (на телефоне — строку списка). */
  focusBlock: string | null;
  alt: string;
};

const freeOf = (units: readonly PickerUnit[] | undefined) =>
  units ? units.filter((unit) => unit.status === "free").length : null;

type Placed = { block: PickerBlockView; contour: Point[]; box: Box; free: number | null };

/**
 * Фасад (мокап .vis__stage): контуры блоков с подписью «Блок A · свободно 12», освещение День / Закат
 * / Ночь (фильтр картинки и тонировка — только CSS), на 1440 при наведении — что осталось по
 * комнатам; на телефоне ниже — список блоков (мокап .vbl). Нажатие на контур или подпись — этажи.
 */
export function PickerFacade({ facade, contours, blocks, units, light, onLight, onPick, focusBlock, alt }: PickerFacadeProps) {
  const [hover, setHover] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusBlock) return;
    const targets = root.current?.querySelectorAll<HTMLElement>(`[data-block-id="${focusBlock}"]`) ?? [];
    [...targets].find((target) => target.offsetParent !== null)?.focus();
  }, [focusBlock]);
  const placed: Placed[] = blocks.flatMap((block) => {
    const contour = contours.find((item) => item.id === block.id)?.contour;
    return contour ? [{ block, contour, box: boxOf(contour), free: freeOf(units[block.id]) }] : [];
  });
  return (
    <div ref={root} className="complex-picker__facade">
      <div className={`complex-picker__stage complex-picker__stage--${light}`}>
        <Image
          src={mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", facade.path)}
          alt={alt}
          width={facade.width}
          height={facade.height}
          sizes="(max-width: 760px) 100vw, 1216px"
          className="complex-picker__image"
        />
        <span className="complex-picker__shade" aria-hidden="true" />
        <FacadeContours placed={placed} hover={hover} onHover={setHover} onPick={onPick} />
        <FacadeTags placed={placed} hover={hover} onHover={setHover} onPick={onPick} />
        {placed.map(({ block, box }) =>
          hover === block.id && units[block.id] ? (
            <FacadeTip key={block.id} block={block} units={units[block.id]!} left={box.cx} top={Math.max(4, box.y0 + 3)} />
          ) : null,
        )}
        <FacadeHint />
      </div>
      <FacadeLights light={light} onLight={onLight} />
      <FacadeList placed={placed} onPick={onPick} />
    </div>
  );
}

type PlacedProps = { placed: Placed[]; hover: string | null; onHover: (id: string | null) => void; onPick: (id: string) => void };

function FacadeContours({ placed, hover, onHover, onPick }: PlacedProps) {
  return (
    <svg className="complex-picker__contours" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {placed.map(({ block, contour, free }) => (
        <polygon
          key={block.id}
          points={polygonPoints(contour)}
          className={[
            "complex-picker__contour",
            hover === block.id ? "complex-picker__contour--hover" : "",
            free === 0 ? "complex-picker__contour--empty" : "",
          ].join(" ")}
          onClick={() => onPick(block.id)}
          onMouseEnter={() => onHover(block.id)}
          onMouseLeave={() => onHover(null)}
        />
      ))}
    </svg>
  );
}

/** Подписи блоков — кнопки (фокус с клавиатуры показывает ту же подсказку, что наведение). */
function FacadeTags({ placed, hover, onHover, onPick }: PlacedProps) {
  const t = useTranslations("complex.pick");
  const labels = useBlockLabels();
  return placed.map(({ block, box, free }) => (
    <button
      key={block.id}
      type="button"
      data-block-id={block.id}
      className={hover === block.id ? "complex-picker__tag complex-picker__tag--on" : "complex-picker__tag"}
      style={{ left: `${Math.min(Math.max(box.cx, 14), 86)}%`, top: `${Math.max(4, box.y0 + 3)}%` }}
      onClick={() => onPick(block.id)}
      onMouseEnter={() => onHover(block.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(block.id)}
      onBlur={() => onHover(null)}
    >
      <b>{labels.name(block)}</b>
      {free !== null ? <small className={free === 0 ? "complex-picker__tag-none" : undefined}>{t("free", { count: free })}</small> : null}
    </button>
  ));
}

function FacadeHint() {
  const t = useTranslations("complex.pick");
  return (
    <p className="complex-picker__hint">
      <Hand size={16} aria-hidden="true" />
      <span className="complex-picker__hint-wide">{t("hint")}</span>
      <span className="complex-picker__hint-phone">{t("hintPhone")}</span>
    </p>
  );
}

/** Телефон (мокап .vbl): блоки списком под фасадом — статус и свободные. */
function FacadeList({ placed, onPick }: { placed: Placed[]; onPick: (id: string) => void }) {
  const t = useTranslations("complex.pick");
  const labels = useBlockLabels();
  return (
    <ul className="complex-picker__blocks">
      {placed.map(({ block, free }) => (
        <li key={block.id}>
          <button type="button" data-block-id={block.id} className="complex-picker__block" onClick={() => onPick(block.id)}>
            <b>{labels.name(block)}</b>
            <span className="complex-picker__block-status">{labels.status(block)}</span>
            {free !== null ? (
              <span className={free === 0 ? "complex-picker__block-free complex-picker__block-free--none" : "complex-picker__block-free"}>
                {t("free", { count: free })}
              </span>
            ) : null}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function FacadeLights({ light, onLight }: { light: FacadeLight; onLight: (light: FacadeLight) => void }) {
  const t = useTranslations("complex.pick");
  return (
    <div className="complex-picker__lights" role="group" aria-label={t("light")}>
      {FACADE_LIGHTS.map((value) => {
        const Icon = LIGHT_ICONS[value];
        return (
          <button key={value} type="button" className="complex-picker__light" aria-pressed={light === value} onClick={() => onLight(value)}>
            <Icon size={16} aria-hidden="true" />
            {t(`lights.${value}`)}
          </button>
        );
      })}
    </div>
  );
}

/** Подсказка мокапа .vtip: блок, статус, всего и свободно, свободные по комнатам. */
function FacadeTip({ block, units, left, top }: { block: PickerBlockView; units: PickerUnit[]; left: number; top: number }) {
  const t = useTranslations("complex.pick");
  const tRooms = useTranslations("complex.rooms");
  const labels = useBlockLabels();
  const free = units.filter((unit) => unit.status === "free").length;
  const up = top > 42;
  return (
    <div className={up ? "complex-picker__tip complex-picker__tip--up" : "complex-picker__tip"} style={{ left: `${Math.min(Math.max(left, 14), 86)}%`, top: `${top}%` }} aria-hidden="true">
      <b className="complex-picker__tip-title">{labels.name(block)}</b>
      <p className="complex-picker__tip-status">{labels.status(block)}</p>
      <p className="complex-picker__tip-row complex-picker__tip-row--head">
        <span>{t("total")}</span>
        <b>{units.length}</b>
      </p>
      <p className="complex-picker__tip-row complex-picker__tip-row--head">
        <span>{t("freeLabel")}</span>
        <b className="complex-picker__tip-free">{free}</b>
      </p>
      {freeByRooms(units).map(({ rooms, free: count }) => (
        <p key={rooms} className="complex-picker__tip-row">
          <span>{rooms <= 4 ? tRooms(String(rooms) as "0") : tRooms("more", { n: rooms })}</span>
          <b>{t("roomsCount", { count })}</b>
        </p>
      ))}
      <p className="complex-picker__tip-go">{t("go")}</p>
    </div>
  );
}
