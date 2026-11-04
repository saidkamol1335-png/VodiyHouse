import type { ActLayer } from "@/lib/site/home/heroRise";

/** Слой сцены → его элемент в разметке первого экрана (позы пишет скроллер). */
export const HERO_LAYERS: Record<ActLayer, string> = {
  "out-eyebrow": ".home-hero__out--eyebrow",
  "out-lead": ".home-hero__out--lead",
  "out-actions": ".home-hero__out--actions",
  "out-cue": ".home-hero__out--cue",
  title: ".home-hero__title",
  perks: ".home-hero__perks",
  horizon: ".home-hero__horizon",
  ledger: ".home-hero__ledger",
  glow: ".home-hero__glow",
  sky: ".home-hero__sky",
  edge: ".home-hero__edge",
  "plate-top": ".home-hero__plate--top",
  "plate-bottom": ".home-hero__plate--bottom",
  "half-top": ".home-hero__half--top",
  "half-bottom": ".home-hero__half--bottom",
  c: ".home-hero__tower--c",
  l1: ".home-hero__tower--l1",
  r1: ".home-hero__tower--r1",
  l2: ".home-hero__tower--l2",
  r2: ".home-hero__tower--r2",
};
