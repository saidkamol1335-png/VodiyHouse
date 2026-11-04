import {
  BriefcaseBusiness,
  Building2,
  Clapperboard,
  ClipboardList,
  DoorOpen,
  FileText,
  HardHat,
  Hourglass,
  LayoutPanelLeft,
  ListChecks,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { ComplexSectionKey } from "@/lib/site/complex/sections";

/** Значок раздела на плитке папки. */
export const ICONS: Record<ComplexSectionKey, LucideIcon> = {
  about: Building2,
  location: MapPin,
  stock: ListChecks,
  pick: DoorOpen,
  soon: Hourglass,
  layouts: LayoutPanelLeft,
  progress: HardHat,
  video: Clapperboard,
  details: ClipboardList,
  developer: BriefcaseBusiness,
  documents: FileText,
};

/** Фоны плиток образца (Figma, Higgsfield, Hotjar, After Effects, Maze, Mixpanel) — по кругу. */
export const TILE_BACKGROUNDS = [
  "linear-gradient(135deg,#2c2c2c,#141414)",
  "linear-gradient(135deg,#e2ff5a,#c6f500)",
  "linear-gradient(135deg,#ff6a3d,#ff3c00)",
  "linear-gradient(135deg,#1a1a7a,#00005b)",
  "linear-gradient(135deg,#2b2b2b,#0d0d0d)",
  "linear-gradient(135deg,#9478ff,#7856ff)",
];
/** Тёмный значок на светлой плитке (лайм Higgsfield), как в образце. */
export const TILE_INK = ["#fff", "#0a0a0a", "#fff", "#99f", "#fff", "#fff"];
