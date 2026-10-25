import { Baby, Bus, Coffee, Cross, Dumbbell, GraduationCap, MoonStar, ShoppingBag, Trees, type LucideIcon } from "lucide-react";
import type { NearbyKind } from "@/lib/site/complex/nearby";

/** Иконки мест рядом (мокап .jloc__ic, .omap__chip): у мечети — полумесяц. */
export const KIND_ICONS: Record<NearbyKind, LucideIcon> = {
  school: GraduationCap,
  kindergarten: Baby,
  mosque: MoonStar,
  clinic: Cross,
  shop: ShoppingBag,
  cafe: Coffee,
  stop: Bus,
  park: Trees,
  sport: Dumbbell,
};
