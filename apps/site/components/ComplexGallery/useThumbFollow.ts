"use client";

import { type RefObject, useEffect } from "react";
import { getMotionTier } from "@/lib/motion";

/** Значения образца: отступ превью в покое от правого нижнего угла, метка «Далее» от курсора / превью. */
const CORNER_INSET = 28;
const LABEL_OFFSET_X = 14;
const LABEL_OFFSET_Y = 10;
const IDLE_LABEL_OFFSET = 8;
/** Догон образца — 0,14 за кадр; без полной анимации — без догона. */
const FOLLOW_SPEED = 0.14;

type FollowRefs = { root: RefObject<HTMLElement | null>; thumb: RefObject<HTMLElement | null>; label: RefObject<HTMLElement | null> };
type Pointer = { x: number; y: number; active: boolean };

/** Кадр слежения: превью догоняет цель, метка — у курсора; цикл идёт, пока превью не догнало. */
function createFollower(host: HTMLElement, box: HTMLElement, tag: HTMLElement, pointer: Pointer) {
  const pos = { x: 0, y: 0, ready: false };
  let frame = 0;
  const tick = () => {
    frame = 0;
    const target = pointer.active
      ? { x: pointer.x, y: pointer.y }
      : { x: host.clientWidth - box.offsetWidth - CORNER_INSET, y: host.clientHeight - box.offsetHeight - CORNER_INSET };
    const k = getMotionTier() === "full" ? FOLLOW_SPEED : 1;
    if (pos.ready) {
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
    } else Object.assign(pos, { ...target, ready: true });
    box.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
    const lx = pointer.active ? pointer.x + LABEL_OFFSET_X : pos.x + IDLE_LABEL_OFFSET;
    const ly = pointer.active ? pointer.y + LABEL_OFFSET_Y : pos.y + IDLE_LABEL_OFFSET;
    tag.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
    if (Math.abs(target.x - pos.x) > 0.3 || Math.abs(target.y - pos.y) > 0.3) frame = requestAnimationFrame(tick);
  };
  return {
    kick: () => {
      if (!frame) frame = requestAnimationFrame(tick);
    },
    stop: () => cancelAnimationFrame(frame),
  };
}

/**
 * Превью следующего кадра идёт за курсором (левый верхний угол — на курсоре), метка «Далее» — рядом
 * с курсором без догона; курсор ушёл или касание — превью в правом нижнем углу (как в образце).
 */
export function useThumbFollow({ root, thumb, label }: FollowRefs, enabled: boolean): void {
  useEffect(() => {
    const host = root.current;
    const box = thumb.current;
    const tag = label.current;
    if (!enabled || !host || !box || !tag) return;
    const pointer: Pointer = { x: 0, y: 0, active: false };
    const follower = createFollower(host, box, tag, pointer);
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = host.getBoundingClientRect();
      Object.assign(pointer, { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true });
      follower.kick();
    };
    const onLeave = () => {
      pointer.active = false;
      follower.kick();
    };
    const sizes = new ResizeObserver(follower.kick);
    sizes.observe(host);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    follower.kick();
    return () => {
      follower.stop();
      sizes.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [root, thumb, label, enabled]);
}
