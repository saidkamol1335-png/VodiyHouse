"use client";

import { useEffect, useState, type RefObject } from "react";

type Edges = { start: boolean; end: boolean };

const NO_EDGES: Edges = { start: false, end: false };
// Запас в 1 px: scrollLeft бывает дробным, и без него затухание мигает у самого края.
const EDGE_TOLERANCE = 1;

function readEdges(track: HTMLElement): Edges {
  const maxScroll = track.scrollWidth - track.clientWidth;
  return {
    start: track.scrollLeft > EDGE_TOLERANCE,
    end: track.scrollLeft < maxScroll - EDGE_TOLERANCE,
  };
}

/**
 * Лента пилюль (К3.4): затухание у того края, за которым ещё есть пункты,
 * и активная пилюля — в зоне видимости после каждого перехода. activeKey — что сменилось
 * при переходе (адрес, вкладка): по нему лента заново прокручивается к активной пилюле.
 */
export function useStripScroll(
  trackRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  activeKey: string,
): Edges {
  const [edges, setEdges] = useState<Edges>(NO_EDGES);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;
    const update = () => setEdges(readEdges(track));
    update();
    track.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [trackRef, enabled]);

  useEffect(() => {
    const track = trackRef.current;
    const active = track?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!enabled || !track || !active) return;
    track.scrollLeft = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
  }, [trackRef, enabled, activeKey]);

  return edges;
}
