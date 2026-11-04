"use client";

import { useRef, useState } from "react";
import { useMotion } from "@/lib/motion";
import type { FlatFrames } from "@/lib/site/home/flatFrames";
import type { FlatRooms } from "@/lib/site/home/flatPicker";
import { FlatSketches } from "./FlatSketch";
import { FlatFeatures, FlatTable, TabPanel } from "./FlatInfo";
import { FlatObject, FlatTabList, useTabSelect } from "./FlatParts";
import { useFlatMotion } from "./useFlatMotion";

export type FlatFigure = { label: string; value: string; note?: string | null };

export type FlatPickerTab = {
  rooms: FlatRooms;
  frames: FlatFrames;
  label: string;
  name: string;
  lines: string[];
  figures: FlatFigure[];
  features: string[];
  cta: string;
  href: string;
  /** Значения строк таблицы сравнения, в порядке FlatPickerText.rows. */
  table: string[];
};

export type FlatPickerText = {
  lead: string;
  wordmark: string;
  caption: string;
  tablist: string;
  tableTitle: string;
  rows: string[];
};

/**
 * Сцена «Выберите свою квартиру». full — useFlatMotion (GSAP: pin ≈ 250svh на десктопе, кадры на
 * canvas по прокрутке); lite — без pin: два кадра (сверху и 3/4) сменяются при появлении; none —
 * сразу 3/4. Вкладки работают везде: стрелки, Home/End, aria-selected.
 */
export function FlatPickerStage({ tabs, text }: { tabs: FlatPickerTab[]; text: FlatPickerText }) {
  const tier = useMotion();
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preload = useFlatMotion({ tier, tabs, active, sectionRef, stageRef, canvasRef });
  const select = useTabSelect({ active, setActive, tier, stageRef, sectionRef });
  const tab = tabs[active]!;
  return (
    <section
      ref={sectionRef}
      className="flat-picker"
      aria-labelledby="flat-picker-lead"
      data-rooms={tab.rooms}
    >
      <div className="flat-picker__pin">
        <h2 id="flat-picker-lead" className="flat-picker__lead">
          {text.lead}
        </h2>
        <p className="flat-picker__wordmark" aria-hidden>
          {text.wordmark}
        </p>
        <FlatSketches rooms={tabs.map((item) => item.rooms)} active={active} />
        <FlatObject tab={tab} caption={text.caption} stageRef={stageRef} canvasRef={canvasRef} />
        <FlatTabList
          tabs={tabs}
          active={active}
          label={text.tablist}
          onSelect={select}
          onPreload={preload}
        />
        <TabPanel key={tab.rooms} tab={tab} />
        <FlatFeatures key={`features-${tab.rooms}`} tab={tab} />
      </div>
      <FlatTable tabs={tabs} text={text} active={active} />
    </section>
  );
}
