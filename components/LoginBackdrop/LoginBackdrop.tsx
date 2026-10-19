"use client";

import Image from "next/image";
import type { LoginVideo } from "@/lib/admin/loginMedia";
import { useMotion } from "@/lib/motion";
import poster from "@/public/media/login/login-poster-demo.webp";

type LoginBackdropProps = {
  video: LoginVideo | null;
};

/**
 * Фон входа — тёмный островок в обеих темах. Ролик играет один раз и замирает на готовом доме,
 * только в full (десктоп с мышью): в lite, на телефоне и при reduced-motion — кадр готового дома.
 * Видео появляется после гидрации, то есть уже после первой отрисовки (CLAUDE.md §3).
 */
export function LoginBackdrop({ video }: LoginBackdropProps) {
  const tier = useMotion();
  return (
    <div className="login-backdrop" aria-hidden="true">
      <Image className="login-backdrop__image" src={poster} alt="" fill priority sizes="100vw" placeholder="blur" />
      {video && tier === "full" ? (
        <video className="login-backdrop__video" muted playsInline autoPlay preload="auto" poster={video.firstFrame}>
          <source src={video.webm} type="video/webm" />
          <source src={video.mp4} type="video/mp4" />
        </video>
      ) : null}
      <div className="login-backdrop__shade" />
    </div>
  );
}
